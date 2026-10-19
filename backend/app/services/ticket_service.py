import re
from datetime import datetime
from typing import List, Optional, Tuple
from fastapi import HTTPException
from sqlalchemy.orm import Session

import uuid
from app.models.asset import Asset
from app.models.ticket import Ticket, TicketHistory, TicketStatus
from app.models.user import User
from app.schemas.ticket import TicketCreate, TicketUpdate
from app.database.repositories import TicketRepository, ActivityLogRepository
from app.services.sla_service import SLAService, calculate_sla_deadline
from app.utils.exceptions import (
    ResourceNotFoundError,
    InvalidStatusTransitionError,
    InvalidTicketError,
)
from app.utils.decorators import log_activity, measure_execution_time

CATEGORIES = {"Hardware", "Software", "Network", "Access", "Other"}
PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
STATUSES = {"OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "ESCALATED"}


def classify_ticket(title: str, description: str) -> Tuple[str, str]:
    text = f"{title or ''} {description or ''}".lower()

    rules = {
        "Hardware": [r"\blaptop\b", r"\bmonitor\b", r"\bkeyboard\b", r"\bmouse\b", r"\bprinter\b", r"\bhardware\b", r"\bbattery\b", r"\bpower\b", r"\bscreen\b"],
        "Software": [r"\bsoftware\b", r"\bapplication\b", r"\bapp\b", r"\bprogram\b", r"\bcrash\b", r"\bbug\b", r"\binstall\b", r"\bos\b", r"\bwindows\b"],
        "Network": [r"\binternet\b", r"\bwifi\b", r"\bnetwork\b", r"\brouter\b", r"\bvpn\b", r"\bdns\b", r"\bconnection\b"],
        "Access": [r"\blogin\b", r"\bpassword\b", r"\baccess\b", r"\bpermission\b", r"\baccount\b", r"\bunauthorized\b"],
    }

    category = "Other"
    for name, patterns in rules.items():
        if any(re.search(pattern, text) for pattern in patterns):
            category = name
            break

    critical_words = ["server down", "security breach", "data loss", "critical", "urgent", "emergency"]
    high_words = ["not starting", "not working", "blocked", "broken", "cannot boot", "high"]

    if any(word in text for word in critical_words):
        priority = "CRITICAL"
    elif any(word in text for word in high_words):
        priority = "HIGH"
    else:
        priority = "MEDIUM"

    return category, priority


def create_ticket(db: Session, user: User, data):
    category, priority = classify_ticket(data.title, data.description)

    cat_candidate = getattr(data, "category", None)
    if cat_candidate:
        cat_str = str(cat_candidate).strip().title()
        if cat_str in CATEGORIES:
            category = cat_str

    pri_candidate = getattr(data, "priority", None)
    if pri_candidate:
        pri_str = str(pri_candidate).strip().upper()
        if pri_str in PRIORITIES:
            priority = pri_str

    now = datetime.utcnow()
    ticket_num = f"INC-{now.strftime('%Y%m%d%H%M%S%f')}"
    # Guard against rare ticket number collision
    if db.query(Ticket.id).filter(Ticket.ticket_number == ticket_num).first():
        ticket_num = f"INC-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

    # Safely validate asset_id to prevent PostgreSQL foreign key constraint violation
    asset_id = getattr(data, "asset_id", None)
    if asset_id is not None:
        try:
            asset_id = int(asset_id)
            if asset_id <= 0:
                asset_id = None
            else:
                asset_exists = db.query(Asset.id).filter(Asset.id == asset_id).first()
                if not asset_exists:
                    asset_id = None
        except (ValueError, TypeError):
            asset_id = None

    initial_status = "OPEN"
    assigned_to_user_id = None
    target_assignee_id = getattr(data, "assigned_to_id", None)
    assigned_user = None
    if target_assignee_id:
        try:
            target_assignee_id = int(target_assignee_id)
            if target_assignee_id > 0:
                support_user = db.query(User).filter(User.id == target_assignee_id).first()
                if support_user and support_user.role in {"SUPPORT", "ADMIN"}:
                    assigned_to_user_id = support_user.id
                    assigned_user = support_user
                    initial_status = "ASSIGNED"
        except (ValueError, TypeError):
            pass

    ticket = Ticket(
        ticket_number=ticket_num,
        title=data.title,
        description=data.description,
        category=category,
        priority=priority,
        created_by_id=user.id,
        assigned_to_id=assigned_to_user_id,
        asset_id=asset_id,
        status=initial_status,
        sla_deadline=calculate_sla_deadline(priority, now),
        created_at=now,
    )

    try:
        db.add(ticket)
        db.flush()

        db.add(
            TicketHistory(
                ticket_id=ticket.id,
                action="CREATED",
                new_status=initial_status,
                comments=f"Ticket created with category {category} and priority {priority}" + (f" and assigned to {assigned_user.name}" if assigned_user else ""),
                creator_name=user.name,
                creator_user_code=user.user_code,
            )
        )

        ActivityLogRepository(db).log(
            action="TICKET_CREATED",
            user_id=user.id,
            ticket_id=ticket.id,
            details=f"Ticket {ticket.ticket_number} created: '{ticket.title}' [{category}/{priority}]" + (f" assigned to {assigned_user.name}" if assigned_user else ""),
        )

        # If mark_under_repair is requested for this asset, update its status
        mark_under_repair = getattr(data, "mark_under_repair", False)
        if asset_id and mark_under_repair:
            asset_obj = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset_obj:
                asset_obj.status = "UNDER_REPAIR"
                ActivityLogRepository(db).log(
                    action="ASSET_UNDER_REPAIR",
                    user_id=user.id,
                    ticket_id=ticket.id,
                    details=f"Asset {asset_obj.asset_tag} ({asset_obj.brand} {asset_obj.model}) marked as UNDER_REPAIR via ticket {ticket.ticket_number}",
                )

        db.commit()
        db.refresh(ticket)
        return ticket
    except Exception as e:
        db.rollback()
        raise e


def assign_ticket(db: Session, ticket: Ticket, support_user: User, actor: Optional[User] = None):
    if support_user.role not in {"SUPPORT", "ADMIN"}:
        raise HTTPException(
            status_code=400,
            detail="Ticket can only be assigned to SUPPORT or ADMIN users",
        )

    old_status = ticket.status
    ticket.assigned_to_id = support_user.id
    ticket.status = "ASSIGNED"

    db.add(
        TicketHistory(
            ticket_id=ticket.id,
            action="ASSIGNED",
            old_status=old_status,
            new_status="ASSIGNED",
            comments=f"Assigned to {support_user.name}",
            creator_name=ticket.creator.name if ticket.creator else None,
            creator_user_code=ticket.creator.user_code if ticket.creator else None,
        )
    )

    actor_id = actor.id if actor else support_user.id
    ActivityLogRepository(db).log(
        action="TICKET_ASSIGNED",
        user_id=actor_id,
        ticket_id=ticket.id,
        details=f"Ticket {ticket.ticket_number} assigned to {support_user.name} ({support_user.user_code})",
    )

    db.commit()
    db.refresh(ticket)
    return ticket


def resolve_ticket(db: Session, ticket: Ticket, resolution: str, actor: Optional[User] = None):
    if ticket.status not in {"ASSIGNED", "IN_PROGRESS", "OPEN"}:
        raise HTTPException(
            status_code=400,
            detail="Ticket cannot be resolved from its current status",
        )

    old_status = ticket.status
    now = datetime.utcnow()
    ticket.status = "RESOLVED"
    ticket.resolution_comment = resolution
    ticket.resolved_at = now
    ticket.is_sla_breached = SLAService.is_breached(ticket.sla_deadline, now)

    db.add(
        TicketHistory(
            ticket_id=ticket.id,
            action="RESOLVED",
            old_status=old_status,
            new_status="RESOLVED",
            comments=resolution,
            creator_name=ticket.creator.name if ticket.creator else None,
            creator_user_code=ticket.creator.user_code if ticket.creator else None,
        )
    )

    actor_id = actor.id if actor else None
    ActivityLogRepository(db).log(
        action="TICKET_RESOLVED",
        user_id=actor_id,
        ticket_id=ticket.id,
        details=f"Ticket {ticket.ticket_number} resolved: {resolution}",
    )

    db.commit()
    db.refresh(ticket)
    return ticket


def close_ticket(db: Session, ticket: Ticket, actor: Optional[User] = None):
    if ticket.status != "RESOLVED":
        raise HTTPException(
            status_code=400,
            detail="Only resolved tickets can be closed",
        )

    old_status = ticket.status
    ticket.status = "CLOSED"
    ticket.closed_at = datetime.utcnow()

    db.add(
        TicketHistory(
            ticket_id=ticket.id,
            action="CLOSED",
            old_status=old_status,
            new_status="CLOSED",
            comments="Ticket closed",
            creator_name=ticket.creator.name if ticket.creator else None,
            creator_user_code=ticket.creator.user_code if ticket.creator else None,
        )
    )

    actor_id = actor.id if actor else None
    ActivityLogRepository(db).log(
        action="TICKET_CLOSED",
        user_id=actor_id,
        ticket_id=ticket.id,
        details=f"Ticket {ticket.ticket_number} closed",
    )

    db.commit()
    db.refresh(ticket)
    return ticket


class TicketService:
    def __init__(self, db: Session):
        self.db = db
        self.ticket_repo = TicketRepository(db)

    @measure_execution_time
    @log_activity("Create Support Ticket")
    def create_ticket(self, data: TicketCreate, creator: User) -> Ticket:
        return create_ticket(self.db, creator, data)

    def get_ticket(self, ticket_id: int) -> Ticket:
        ticket = self.ticket_repo.get_by_id(ticket_id)
        if not ticket:
            raise ResourceNotFoundError(f"Ticket with id {ticket_id} not found")
        ticket.is_sla_breached = SLAService.is_breached(ticket.sla_deadline, ticket.resolved_at)
        return ticket

    def list_tickets(
        self,
        current_user: User,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        category: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Ticket]:
        if current_user.role == "EMPLOYEE":
            tickets = self.ticket_repo.list_tickets(
                skip=skip,
                limit=limit,
                status=status,
                priority=priority,
                category=category,
                created_by_id=current_user.id,
            )
        else:
            tickets = self.ticket_repo.list_tickets(
                skip=skip,
                limit=limit,
                status=status,
                priority=priority,
                category=category,
            )

        now = datetime.utcnow()
        for t in tickets:
            t.is_sla_breached = SLAService.is_breached(t.sla_deadline, t.resolved_at)
        return tickets

    @measure_execution_time
    @log_activity("Assign Support Ticket")
    def assign_ticket(self, ticket_id: int, assigned_to_id: int, actor: User) -> Ticket:
        ticket = self.get_ticket(ticket_id)
        support_user = self.db.query(User).filter(User.id == assigned_to_id).first()
        if not support_user:
            raise ResourceNotFoundError(f"Support user with id {assigned_to_id} not found")
        return assign_ticket(self.db, ticket, support_user)

    @measure_execution_time
    @log_activity("Resolve Support Ticket")
    def resolve_ticket(self, ticket_id: int, resolution_comment: str, actor: User) -> Ticket:
        ticket = self.get_ticket(ticket_id)
        return resolve_ticket(self.db, ticket, resolution_comment)

    @measure_execution_time
    @log_activity("Close Support Ticket")
    def close_ticket(self, ticket_id: int, actor: User, comments: Optional[str] = None) -> Ticket:
        ticket = self.get_ticket(ticket_id)
        return close_ticket(self.db, ticket)

    def update_ticket(self, ticket_id: int, data: TicketUpdate, actor: User) -> Ticket:
        ticket = self.get_ticket(ticket_id)
        if data.title is not None:
            ticket.title = data.title
        if data.description is not None:
            ticket.description = data.description
        if data.category is not None:
            ticket.category = data.category
        if data.priority is not None and data.priority != ticket.priority:
            ticket.priority = data.priority
            ticket.sla_deadline = calculate_sla_deadline(data.priority, ticket.created_at)
            ticket.is_sla_breached = SLAService.is_breached(ticket.sla_deadline, ticket.resolved_at)

        self.ticket_repo.update(ticket)
        return ticket
