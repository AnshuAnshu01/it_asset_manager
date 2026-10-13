from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.user import User
from app.models.asset import Asset, AssetAssignment, AssetStatus
from app.models.ticket import Ticket, TicketHistory, ActivityLog, TicketStatus
from app.utils.exceptions import DatabaseConnectionError


# Standalone repository functions
def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter((User.email == username) | (User.user_code == username)).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower()).first()


def get_asset(db: Session, asset_id: int) -> Optional[Asset]:
    return db.query(Asset).filter(Asset.id == asset_id).first()


def get_ticket(db: Session, ticket_id: int) -> Optional[Ticket]:
    return db.query(Ticket).filter(Ticket.id == ticket_id).first()


# Class-based repository layer
class BaseRepository:
    def __init__(self, db: Session):
        self.db = db


class UserRepository(BaseRepository):
    def get_by_id(self, user_id: int) -> Optional[User]:
        return get_user(self.db, user_id)

    def get_by_email(self, email: str) -> Optional[User]:
        return get_user_by_email(self.db, email)

    def get_by_user_code(self, user_code: str) -> Optional[User]:
        return self.db.query(User).filter(User.user_code == user_code).first()

    def list_users(self, skip: int = 0, limit: int = 100, role: Optional[str] = None) -> List[User]:
        query = self.db.query(User)
        if role:
            query = query.filter(User.role == role.upper())
        return query.offset(skip).limit(limit).all()

    def count_users(self) -> int:
        return self.db.query(User).count()

    def create(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User) -> User:
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete(self, user: User) -> None:
        self.db.delete(user)
        self.db.commit()


class AssetRepository(BaseRepository):
    def get_by_id(self, asset_id: int) -> Optional[Asset]:
        return get_asset(self.db, asset_id)

    def get_by_tag(self, asset_tag: str) -> Optional[Asset]:
        return self.db.query(Asset).filter(Asset.asset_tag == asset_tag).first()

    def get_by_serial(self, serial_number: str) -> Optional[Asset]:
        return self.db.query(Asset).filter(Asset.serial_number == serial_number).first()

    def list_assets(
        self,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        asset_type: Optional[str] = None,
        assigned_to_id: Optional[int] = None,
    ) -> List[Asset]:
        query = self.db.query(Asset)
        if status:
            query = query.filter(Asset.status == status.upper())
        if asset_type:
            query = query.filter(Asset.asset_type == asset_type)
        if assigned_to_id is not None:
            query = query.filter(Asset.assigned_to_id == assigned_to_id)
        return query.order_by(Asset.id.desc()).offset(skip).limit(limit).all()

    def create(self, asset: Asset) -> Asset:
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def update(self, asset: Asset) -> Asset:
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def delete(self, asset: Asset) -> None:
        self.db.delete(asset)
        self.db.commit()

    def add_assignment(self, assignment: AssetAssignment) -> AssetAssignment:
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def get_active_assignment(self, asset_id: int) -> Optional[AssetAssignment]:
        return (
            self.db.query(AssetAssignment)
            .filter(AssetAssignment.asset_id == asset_id, AssetAssignment.returned_date.is_(None))
            .order_by(AssetAssignment.assigned_date.desc())
            .first()
        )

    def count_by_status(self) -> Dict[str, int]:
        results = self.db.query(Asset.status, func.count(Asset.id)).group_by(Asset.status).all()
        return dict(results)

    def count_by_type(self) -> Dict[str, int]:
        results = self.db.query(Asset.asset_type, func.count(Asset.id)).group_by(Asset.asset_type).all()
        return dict(results)


class TicketRepository(BaseRepository):
    def get_by_id(self, ticket_id: int) -> Optional[Ticket]:
        return get_ticket(self.db, ticket_id)

    def get_by_number(self, ticket_number: str) -> Optional[Ticket]:
        return self.db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()

    def list_tickets(
        self,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        category: Optional[str] = None,
        created_by_id: Optional[int] = None,
        assigned_to_id: Optional[int] = None,
    ) -> List[Ticket]:
        query = self.db.query(Ticket)
        if status:
            query = query.filter(Ticket.status == status.upper())
        if priority:
            query = query.filter(Ticket.priority == priority.upper())
        if category:
            query = query.filter(Ticket.category == category)
        if created_by_id:
            query = query.filter(Ticket.created_by_id == created_by_id)
        if assigned_to_id:
            query = query.filter(Ticket.assigned_to_id == assigned_to_id)
        return query.order_by(desc(Ticket.created_at)).offset(skip).limit(limit).all()

    def create(self, ticket: Ticket) -> Ticket:
        self.db.add(ticket)
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def update(self, ticket: Ticket) -> Ticket:
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def add_history(self, history: TicketHistory) -> TicketHistory:
        self.db.add(history)
        self.db.commit()
        self.db.refresh(history)
        return history

    def count_by_status(self) -> Dict[str, int]:
        results = self.db.query(Ticket.status, func.count(Ticket.id)).group_by(Ticket.status).all()
        return dict(results)

    def count_by_priority(self) -> Dict[str, int]:
        results = self.db.query(Ticket.priority, func.count(Ticket.id)).group_by(Ticket.priority).all()
        return dict(results)

    def count_by_category(self) -> Dict[str, int]:
        results = self.db.query(Ticket.category, func.count(Ticket.id)).group_by(Ticket.category).all()
        return dict(results)

    def get_sla_metrics(self) -> Dict[str, Any]:
        total = self.db.query(Ticket).count()
        breached = self.db.query(Ticket).filter(Ticket.is_sla_breached.is_(True)).count()
        return {"total": total, "breached": breached}


class ActivityLogRepository(BaseRepository):
    def log(
        self,
        action: str,
        user_id: Optional[int] = None,
        details: Optional[str] = None,
        ip_address: Optional[str] = None,
        ticket_id: Optional[int] = None,
    ) -> Optional[ActivityLog]:
        user_code = None
        if user_id:
            user = self.db.query(User).filter(User.id == user_id).first()
            if user:
                user_code = user.user_code
        
        entry = ActivityLog(
            user_id=user_id,
            user_code=user_code,
            ticket_id=ticket_id,
            action=action,
            details=details,
            ip_address=ip_address,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def list_logs(
        self,
        limit: int = 50,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
    ) -> List[ActivityLog]:
        query = self.db.query(ActivityLog)
        if user_id is not None:
            query = query.filter(ActivityLog.user_id == user_id)
        if action:
            query = query.filter(ActivityLog.action == action)
        return query.order_by(desc(ActivityLog.created_at)).limit(limit).all()