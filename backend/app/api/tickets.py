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

    return query.all()


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
def add_ticket(
    data: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("EMPLOYEE", "ADMIN")),
):
    return create_ticket(db, current_user, data)


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
    return ticket


@router.post("/{ticket_id}/assign", response_model=TicketResponse)
def assign(
    ticket_id: int,
    data: TicketAssignRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN")),
):
    target_id = data.support_user_id if data.support_user_id is not None else data.assigned_to_id
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    support = db.query(User).filter(User.id == target_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not support:
        raise HTTPException(status_code=404, detail="Support user not found")

    return assign_ticket(db, ticket, support)


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
    return resolve_ticket(db, ticket, res_comment)


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
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/{ticket_id}/close", response_model=TicketResponse)
def close(
    ticket_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("SUPPORT", "ADMIN")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return close_ticket(db, ticket)
