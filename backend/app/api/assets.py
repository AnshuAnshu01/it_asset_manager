from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, require_roles
from app.database.connection import get_db
from app.models.asset import Asset
from app.models.user import User
from app.schemas.asset import (
    AssetAssignRequest,
    AssetCreate,
    AssetResponse,
    AssetUpdate,
)
from app.services.asset_service import (
    assign_asset,
    create_asset,
    return_asset,
)
from app.database.repositories import ActivityLogRepository

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.get("/", response_model=list[AssetResponse])
def list_assets(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(Asset).order_by(Asset.id.asc()).all()


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.post("/", response_model=AssetResponse, status_code=201)
def add_asset(
    data: AssetCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    return create_asset(db, data, actor=admin)


@router.put("/{asset_id}", response_model=AssetResponse)
def edit_asset(
    asset_id: int,
    data: AssetUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(asset, key, value)

    db.commit()
    db.refresh(asset)

    ActivityLogRepository(db).log(
        action="UPDATE_ASSET",
        user_id=admin.id,
        details=f"Admin {admin.email} updated asset {asset.asset_tag} ({asset.brand} {asset.model})",
    )

    return asset


@router.delete("/{asset_id}")
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset.status = "RETIRED"
    db.commit()

    ActivityLogRepository(db).log(
        action="RETIRE_ASSET",
        user_id=admin.id,
        details=f"Admin {admin.email} retired asset {asset.asset_tag}",
    )

    return {"message": "Asset retired"}


@router.post("/{asset_id}/assign", response_model=AssetResponse)
def assign(
    asset_id: int,
    data: AssetAssignRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    user = db.query(User).filter(User.id == data.user_id).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return assign_asset(db, asset, user, actor=admin)


@router.post("/{asset_id}/return", response_model=AssetResponse)
def return_asset_endpoint(
    asset_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    return return_asset(db, asset, actor=admin)

