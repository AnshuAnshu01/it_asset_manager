from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.auth import get_current_user, require_roles
from app.database.connection import get_db
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ticket import (
    TicketAssignRequest,
    TicketCreate,
    TicketResponse,
    TicketResolveRequest,
    TicketUpdate,
)
from app.services.ticket_service import (
    assign_ticket,
    close_ticket,
    create_ticket,
    resolve_ticket,
)
from app.database.repositories import ActivityLogRepository

router = APIRouter(prefix="/tickets", tags=["Tickets"])


@router.get("/", response_model=list[TicketResponse])
def list_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Ticket)

    if current_user.role == "EMPLOYEE":
        query = query.filter(Ticket.created_by_id == current_user.id)
    elif current_user.role == "SUPPORT":
        query = query.filter(Ticket.assigned_to_id == current_user.id)

    return query.order_by(Ticket.created_at.desc(), Ticket.id.desc()).all()


@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if (
        current_user.role == "EMPLOYEE"
        and ticket.created_by != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    if (
        current_user.role == "SUPPORT"
        and ticket.assigned_to != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    return ticket


@router.post("/", response_model=TicketResponse, status_code=201)
async def add_ticket(
    data: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = create_ticket(db, current_user, data)
    try:
        from app.api.websocket import ws_manager
        await ws_manager.broadcast({
            "event": "TICKET_CREATED",
            "ticket_number": ticket.ticket_number,
            "title": ticket.title,
            "priority": ticket.priority,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        })
    except Exception:
        pass
    return ticket


@router.put("/{ticket_id}", response_model=TicketResponse)
def edit_ticket(
    ticket_id: int,
    data: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if current_user.role == "EMPLOYEE" and ticket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(ticket, key, value)

    db.commit()
    db.refresh(ticket)

    ActivityLogRepository(db).log(
        action="TICKET_UPDATED",
        user_id=current_user.id,
        ticket_id=ticket.id,
        details=f"Ticket {ticket.ticket_number} updated by {current_user.name}",
    )

    return ticket


@router.post("/{ticket_id}/assign", response_model=TicketResponse)
def assign(
    ticket_id: int,
    data: TicketAssignRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    target_id = data.support_user_id if data.support_user_id is not None else data.assigned_to_id
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    support = db.query(User).filter(User.id == target_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not support:
        raise HTTPException(status_code=404, detail="Support user not found")

    return assign_ticket(db, ticket, support, actor=admin)


@router.post("/{ticket_id}/process", response_model=TicketResponse)
def process(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPPORT", "ADMIN")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old_status = ticket.status
    ticket.status = "IN_PROGRESS"

    from app.models.ticket import TicketHistory
    db.add(
        TicketHistory(
            ticket_id=ticket.id,
            changed_by_id=current_user.id,
            action="STARTED_PROCESSING",
            old_status=old_status,
            new_status="IN_PROGRESS",
            comments=f"Processing started by {current_user.name}",
            creator_name=ticket.creator.name if ticket.creator else None,
            creator_user_code=ticket.creator.user_code if ticket.creator else None,
        )
    )

    ActivityLogRepository(db).log(
        action="TICKET_IN_PROGRESS",
        user_id=current_user.id,
        ticket_id=ticket.id,
        details=f"Ticket {ticket.ticket_number} processing started by {current_user.name}",
    )

    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/{ticket_id}/resolve", response_model=TicketResponse)
def resolve(
    ticket_id: int,
    data: TicketResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPPORT", "ADMIN")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if current_user.role == "SUPPORT" and ticket.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    res_comment = data.resolution or data.resolution_comment or "Resolved"
    return resolve_ticket(db, ticket, res_comment, actor=current_user)


class TicketEscalateRequest(BaseModel):
    reason: str

@router.post("/{ticket_id}/escalate", response_model=TicketResponse)
def escalate(
    ticket_id: int,
    data: TicketEscalateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPPORT")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    old_status = ticket.status
    ticket.status = "ESCALATED"

    from app.models.ticket import TicketHistory
    db.add(
        TicketHistory(
            ticket_id=ticket.id,
            changed_by_id=current_user.id,
            action="ESCALATED",
            old_status=old_status,
            new_status="ESCALATED",
            comments=f"Escalated to Admin: {data.reason}",
            creator_name=ticket.creator.name if ticket.creator else None,
            creator_user_code=ticket.creator.user_code if ticket.creator else None,
        )
    )

    ActivityLogRepository(db).log(
        action="TICKET_ESCALATED",
        user_id=current_user.id,
        ticket_id=ticket.id,
        details=f"Ticket {ticket.ticket_number} escalated to Admin: {data.reason}",
    )

    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/{ticket_id}/close", response_model=TicketResponse)
def close(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPPORT", "ADMIN")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return close_ticket(db, ticket, actor=current_user)

