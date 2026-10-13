from typing import Dict, Any, Generator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.ticket import Ticket
from app.database.repositories import TicketRepository, AssetRepository
from app.services.sla_service import SLAService, get_sla_status
from app.utils.generators import ticket_stream_generator


def ticket_report(db: Session):
    total = db.query(Ticket).count()
    open_count = db.query(Ticket).filter(
        Ticket.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS"])
    ).count()
    resolved = db.query(Ticket).filter(
        Ticket.status.in_(["RESOLVED", "CLOSED"])
    ).count()

    by_priority = dict(
        db.query(Ticket.priority, func.count(Ticket.id))
        .group_by(Ticket.priority)
        .all()
    )

    by_category = dict(
        db.query(Ticket.category, func.count(Ticket.id))
        .group_by(Ticket.category)
        .all()
    )

    return {
        "total_tickets": total,
        "total": total,
        "open": open_count,
        "resolved_or_closed": resolved,
        "by_status": {
            "OPEN": open_count,
            "RESOLVED": resolved,
        },
        "by_priority": by_priority,
        "by_category": by_category,
    }


def asset_report(db: Session):
    rows = dict(
        db.query(Asset.status, func.count(Asset.id))
        .group_by(Asset.status)
        .all()
    )
    by_type = dict(
        db.query(Asset.asset_type, func.count(Asset.id))
        .group_by(Asset.asset_type)
        .all()
    )
    total = db.query(Asset).count()
    return {
        "total_assets": total,
        "total": total,
        "by_status": rows,
        "by_type": by_type,
    }


def sla_report(db: Session):
    tickets = db.query(Ticket).all()
    total = len(tickets)
    breached = 0
    active = 0
    resolution_hours_list = []

    for ticket in tickets:
        if ticket.sla_deadline and ticket.status not in {"CLOSED"}:
            info = get_sla_status(ticket.sla_deadline)
            if info["breached"]:
                breached += 1
            else:
                active += 1
        if ticket.resolved_at and ticket.created_at:
            res_time = SLAService.calculate_resolution_time_hours(ticket.created_at, ticket.resolved_at)
            resolution_hours_list.append(res_time)

    compliance_rate = round(((total - breached) / total * 100.0) if total > 0 else 100.0, 2)
    avg_res_time = round(SLAService.calculate_average_resolution_time(resolution_hours_list), 2)

    return {
        "total_tickets": total,
        "breached_tickets": breached,
        "sla_breached": breached,
        "sla_active": active,
        "compliance_rate_percent": compliance_rate,
        "avg_resolution_time_hours": avg_res_time,
    }


class ReportService:
    def __init__(self, db: Session):
        self.db = db
        self.ticket_repo = TicketRepository(db)
        self.asset_repo = AssetRepository(db)

    def get_ticket_metrics(self) -> Dict[str, Any]:
        return ticket_report(self.db)

    def get_asset_metrics(self) -> Dict[str, Any]:
        return asset_report(self.db)

    def get_sla_metrics(self) -> Dict[str, Any]:
        return sla_report(self.db)

    def get_support_workload(self) -> list:
        from app.models.user import User
        support_users = self.db.query(User).filter(User.role == "SUPPORT").all()
        results = []
        for su in support_users:
            tickets = self.db.query(Ticket).filter(Ticket.assigned_to_id == su.id).all()
            total = len(tickets)
            completed = sum(1 for t in tickets if t.status in {"RESOLVED", "CLOSED"})
            pending = sum(1 for t in tickets if t.status in {"ASSIGNED", "OPEN", "ESCALATED"})
            processing = sum(1 for t in tickets if t.status == "IN_PROGRESS")
            results.append({
                "id": su.id,
                "name": su.name,
                "user_code": su.user_code,
                "total_assigned": total,
                "completed": completed,
                "pending": pending,
                "processing": processing
            })
        return results

    def stream_tickets_csv(self) -> Generator[str, None, None]:
        tickets = self.db.query(Ticket).order_by(Ticket.id).all()
        return ticket_stream_generator(tickets)
