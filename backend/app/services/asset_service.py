from datetime import datetime, date
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.asset import Asset, AssetAssignment, AssetStatus
from app.models.user import User
from app.schemas.asset import AssetCreate, AssetUpdate
from app.database.repositories import AssetRepository, UserRepository, ActivityLogRepository
from app.services.asset_oop import create_asset_oop_instance
from app.utils.exceptions import (
    ResourceNotFoundError,
    InvalidAssetError,
    InvalidStatusTransitionError,
)
from app.utils.decorators import log_activity, measure_execution_time


def create_asset(db: Session, data: AssetCreate) -> Asset:
    service = AssetService(db)
    existing = service.asset_repo.get_by_serial(data.serial_number)
    if existing:
        raise InvalidAssetError(f"Serial number {data.serial_number} already exists")

    tag = data.asset_tag or service._generate_asset_tag(data.asset_type)
    asset = Asset(
        asset_tag=tag,
        asset_type=data.asset_type,
        brand=data.brand,
        model=data.model,
        serial_number=data.serial_number,
        purchase_date=data.purchase_date or date.today(),
        status=AssetStatus.AVAILABLE.value,
        specifications=data.specifications or {},
        notes=data.notes,
    )
    return service.asset_repo.create(asset)


def assign_asset(db: Session, asset: Asset, user: User, notes: Optional[str] = None) -> Asset:
    if asset.status == AssetStatus.ASSIGNED.value:
        raise InvalidStatusTransitionError(f"Asset {asset.asset_tag} is already assigned")
    asset.status = AssetStatus.ASSIGNED.value
    asset.assigned_to_id = user.id
    assignment = AssetAssignment(
        asset_id=asset.id,
        user_id=user.id,
        assigned_date=datetime.utcnow(),
        notes=notes,
    )
    db.add(assignment)
    db.commit()
    db.refresh(asset)
    return asset


def return_asset(db: Session, asset: Asset, notes: Optional[str] = None) -> Asset:
    if asset.status != AssetStatus.ASSIGNED.value:
        raise InvalidStatusTransitionError(f"Asset {asset.asset_tag} is not currently assigned")
    assignment = (
        db.query(AssetAssignment)
        .filter(AssetAssignment.asset_id == asset.id, AssetAssignment.returned_date.is_(None))
        .order_by(AssetAssignment.assigned_date.desc())
        .first()
    )
    if assignment:
        assignment.returned_date = datetime.utcnow()
    asset.status = AssetStatus.AVAILABLE.value
    asset.assigned_to_id = None
    db.commit()
    db.refresh(asset)
    return asset


class AssetService:
    def __init__(self, db: Session):
        self.db = db
        self.asset_repo = AssetRepository(db)
        self.user_repo = UserRepository(db)
        self.activity_repo = ActivityLogRepository(db)

    def _generate_asset_tag(self, asset_type: str) -> str:
        prefix_map = {
            "Laptop": "LAP",
            "Monitor": "MON",
            "Keyboard": "KEY",
            "Mouse": "MOU",
            "Printer": "PRN",
        }
        prefix = prefix_map.get(asset_type, "AST")
        count = self.asset_repo.count_by_type().get(asset_type, 0) + 1001
        return f"{prefix}-{count}"

    @measure_execution_time
    @log_activity("Create Asset")
    def create_asset(self, data: AssetCreate, actor: Optional[User] = None) -> Asset:
        asset = create_asset(self.db, data)
        if actor:
            self.activity_repo.log(
                action="CREATE_ASSET",
                user_id=actor.id,
                details=f"Created asset {asset.asset_tag} ({asset.asset_type})",
            )
        return asset

    def get_asset(self, asset_id: int) -> Asset:
        asset = self.asset_repo.get_by_id(asset_id)
        if not asset:
            raise ResourceNotFoundError(f"Asset with id {asset_id} not found")
        return asset

    def get_asset_oop_diagnostics(self, asset_id: int):
        asset = self.get_asset(asset_id)
        oop_obj = create_asset_oop_instance(
            asset_type=asset.asset_type,
            asset_id=asset.asset_tag,
            brand=asset.brand,
            model=asset.model,
            serial_number=asset.serial_number,
            purchase_date=asset.purchase_date,
            status=asset.status,
            specifications=asset.specifications or {},
        )
        return {
            "summary": oop_obj.get_summary(),
            "diagnostics": oop_obj.run_diagnostics(),
            "maintenance_interval_days": oop_obj.get_maintenance_interval_days(),
        }

    def list_assets(
        self,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        asset_type: Optional[str] = None,
        assigned_to_id: Optional[int] = None,
    ) -> List[Asset]:
        return self.asset_repo.list_assets(
            skip=skip,
            limit=limit,
            status=status,
            asset_type=asset_type,
            assigned_to_id=assigned_to_id,
        )

    def update_asset(self, asset_id: int, data: AssetUpdate, actor: Optional[User] = None) -> Asset:
        asset = self.get_asset(asset_id)
        if data.brand is not None:
            asset.brand = data.brand
        if data.model is not None:
            asset.model = data.model
        if data.status is not None:
            asset.status = data.status
        if data.specifications is not None:
            asset.specifications = data.specifications
        if data.notes is not None:
            asset.notes = data.notes

        self.asset_repo.update(asset)
        if actor:
            self.activity_repo.log(
                action="UPDATE_ASSET",
                user_id=actor.id,
                details=f"Updated asset {asset.asset_tag}",
            )
        return asset

    @measure_execution_time
    @log_activity("Assign Asset")
    def assign_asset(self, asset_id: int, user_id: int, actor: Optional[User] = None, notes: Optional[str] = None) -> Asset:
        asset = self.get_asset(asset_id)
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise ResourceNotFoundError(f"Target user with id {user_id} not found")
        assigned = assign_asset(self.db, asset, user, notes=notes)
        if actor:
            self.activity_repo.log(
                action="ASSIGN_ASSET",
                user_id=actor.id,
                details=f"Assigned asset {asset.asset_tag} to user {user.email}",
            )
        return assigned

    @measure_execution_time
    @log_activity("Return Asset")
    def return_asset(self, asset_id: int, actor: Optional[User] = None, notes: Optional[str] = None) -> Asset:
        asset = self.get_asset(asset_id)
        returned = return_asset(self.db, asset, notes=notes)
        if actor:
            self.activity_repo.log(
                action="RETURN_ASSET",
                user_id=actor.id,
                details=f"Returned asset {asset.asset_tag}",
            )
        return returned

    def delete_asset(self, asset_id: int, actor: Optional[User] = None) -> None:
        asset = self.get_asset(asset_id)
        if asset.status == AssetStatus.ASSIGNED.value:
            raise InvalidStatusTransitionError("Cannot delete an assigned asset. Return it first.")
        self.asset_repo.delete(asset)
        if actor:
            self.activity_repo.log(
                action="DELETE_ASSET",
                user_id=actor.id,
                details=f"Deleted asset {asset.asset_tag}",
            )
