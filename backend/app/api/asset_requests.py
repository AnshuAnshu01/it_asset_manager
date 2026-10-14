from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.api.auth import get_current_user, require_roles
from app.database.connection import get_db
from app.models.asset import Asset, AssetStatus
from app.models.asset_request import AssetRequest, AssetRequestStatus
from app.models.user import User
from app.schemas.asset import AssetResponse
from app.schemas.asset_request import (
    AssetRequestCreate,
    AssetRequestAssign,
    AssetRequestReject,
    AssetRequestResponse,
)
from app.services.asset_service import assign_asset
from app.database.repositories import ActivityLogRepository
from app.api.websocket import ws_manager

router = APIRouter(prefix="/asset-requests", tags=["Asset Requests"])


@router.get("/", response_model=List[AssetRequestResponse])
def list_asset_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(AssetRequest)
        .options(
            joinedload(AssetRequest.user),
            joinedload(AssetRequest.assigned_asset),
            joinedload(AssetRequest.assigned_by),
        )
    )

    # Non-admin users see only their own requests
    if current_user.role != "ADMIN":
        query = query.filter(AssetRequest.user_id == current_user.id)

    if status_filter:
        query = query.filter(AssetRequest.status == status_filter.upper())

    return query.order_by(AssetRequest.created_at.desc(), AssetRequest.id.desc()).all()


@router.get("/inventory/available", response_model=List[AssetResponse])
def get_available_inventory(
    asset_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Asset).filter(Asset.status == AssetStatus.AVAILABLE.value)
    if asset_type:
        query = query.filter(Asset.asset_type.ilike(asset_type))
    return query.order_by(Asset.asset_type.asc(), Asset.asset_tag.asc()).all()


@router.post("/", response_model=AssetRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_asset_request(
    data: AssetRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Requirement: All users except admin can create an asset request
    if current_user.role == "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot submit asset requests. Only employees and support staff can request assets.",
        )

    # Generate sequential unique request number
    count = db.query(AssetRequest).count() + 1001
    request_number = f"REQ-{count}"
    while db.query(AssetRequest).filter(AssetRequest.request_number == request_number).first():
        count += 1
        request_number = f"REQ-{count}"

    asset_req = AssetRequest(
        request_number=request_number,
        user_id=current_user.id,
        asset_type=data.asset_type,
        preferred_specs=data.preferred_specs,
        reason=data.reason,
        priority=data.priority or "MEDIUM",
        status=AssetRequestStatus.PENDING.value,
    )
    db.add(asset_req)
    db.commit()
    db.refresh(asset_req)

    # Log activity
    ActivityLogRepository(db).log(
        action="CREATE_ASSET_REQUEST",
        user_id=current_user.id,
        details=(
            f"User {current_user.name} ({current_user.email}) requested a {data.asset_type} "
            f"({data.priority} priority, Ref: {data.preferred_specs or 'Standard'}) - {request_number}"
        ),
    )

    # Broadcast real-time notification to admin
    try:
        await ws_manager.broadcast({
            "event": "ASSET_REQUEST_CREATED",
            "request_number": asset_req.request_number,
            "user_name": current_user.name,
            "department": current_user.department,
            "asset_type": asset_req.asset_type,
            "priority": asset_req.priority,
            "created_at": asset_req.created_at.isoformat(),
        })
    except Exception:
        pass

    return asset_req


@router.get("/{request_id}", response_model=AssetRequestResponse)
def get_asset_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset_req = (
        db.query(AssetRequest)
        .options(
            joinedload(AssetRequest.user),
            joinedload(AssetRequest.assigned_asset),
            joinedload(AssetRequest.assigned_by),
        )
        .filter(AssetRequest.id == request_id)
        .first()
    )
    if not asset_req:
        raise HTTPException(status_code=404, detail="Asset request not found")

    if current_user.role != "ADMIN" and asset_req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return asset_req


@router.post("/{request_id}/assign", response_model=AssetRequestResponse)
async def assign_asset_to_request(
    request_id: int,
    data: AssetRequestAssign,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    asset_req = db.query(AssetRequest).filter(AssetRequest.id == request_id).first()
    if not asset_req:
        raise HTTPException(status_code=404, detail="Asset request not found")

    if asset_req.status != AssetRequestStatus.PENDING.value:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot assign asset to a request with status '{asset_req.status}'",
        )

    asset = db.query(Asset).filter(Asset.id == data.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Selected asset not found in inventory")

    if asset.status != AssetStatus.AVAILABLE.value:
        raise HTTPException(
            status_code=400,
            detail=f"Asset {asset.asset_tag} is not available (current status: {asset.status})",
        )

    requester = db.query(User).filter(User.id == asset_req.user_id).first()
    if not requester:
        raise HTTPException(status_code=404, detail="Requester user not found")

    # Assign asset in inventory to the user
    assign_asset(
        db=db,
        asset=asset,
        user=requester,
        notes=f"Assigned for Request {asset_req.request_number}: {data.admin_notes or 'Fulfilled by admin'}",
        actor=admin,
    )

    # Update request status and linkage
    asset_req.status = AssetRequestStatus.ASSIGNED.value
    asset_req.assigned_asset_id = asset.id
    asset_req.assigned_by_id = admin.id
    asset_req.admin_notes = data.admin_notes
    asset_req.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(asset_req)

    # Log activity
    ActivityLogRepository(db).log(
        action="FULFILL_ASSET_REQUEST",
        user_id=admin.id,
        details=(
            f"Admin {admin.email} fulfilled Asset Request {asset_req.request_number} by assigning "
            f"{asset.asset_tag} ({asset.brand} {asset.model}) to {requester.name}"
        ),
    )

    # Broadcast notification
    try:
        await ws_manager.broadcast({
            "event": "ASSET_REQUEST_ASSIGNED",
            "request_number": asset_req.request_number,
            "asset_tag": asset.asset_tag,
            "user_name": requester.name,
            "assigned_at": datetime.utcnow().isoformat(),
        })
    except Exception:
        pass

    return asset_req


@router.post("/{request_id}/reject", response_model=AssetRequestResponse)
async def reject_asset_request(
    request_id: int,
    data: AssetRequestReject,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    asset_req = db.query(AssetRequest).filter(AssetRequest.id == request_id).first()
    if not asset_req:
        raise HTTPException(status_code=404, detail="Asset request not found")

    if asset_req.status != AssetRequestStatus.PENDING.value:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject a request with status '{asset_req.status}'",
        )

    asset_req.status = AssetRequestStatus.REJECTED.value
    asset_req.assigned_by_id = admin.id
    asset_req.admin_notes = data.admin_notes or "Request rejected by administrator"
    asset_req.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(asset_req)

    ActivityLogRepository(db).log(
        action="REJECT_ASSET_REQUEST",
        user_id=admin.id,
        details=f"Admin {admin.email} rejected Asset Request {asset_req.request_number}",
    )

    try:
        await ws_manager.broadcast({
            "event": "ASSET_REQUEST_REJECTED",
            "request_number": asset_req.request_number,
            "rejected_at": datetime.utcnow().isoformat(),
        })
    except Exception:
        pass

    return asset_req


@router.delete("/{request_id}")
def cancel_asset_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset_req = db.query(AssetRequest).filter(AssetRequest.id == request_id).first()
    if not asset_req:
        raise HTTPException(status_code=404, detail="Asset request not found")

    if current_user.role != "ADMIN" and asset_req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if asset_req.status == AssetRequestStatus.ASSIGNED.value:
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel an already assigned request. Contact admin to return the asset.",
        )

    asset_req.status = AssetRequestStatus.CANCELLED.value
    asset_req.updated_at = datetime.utcnow()
    db.commit()

    ActivityLogRepository(db).log(
        action="CANCEL_ASSET_REQUEST",
        user_id=current_user.id,
        details=f"User {current_user.name} cancelled Asset Request {asset_req.request_number}",
    )

    return {"message": "Asset request cancelled"}
