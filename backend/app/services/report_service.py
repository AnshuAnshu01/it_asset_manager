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

    status_counts = dict(
        db.query(Ticket.status, func.count(Ticket.id))
        .group_by(Ticket.status)
        .all()
    )
    standard_statuses = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "ESCALATED"]
    by_status = {s: status_counts.get(s, 0) for s in standard_statuses}
    for k, v in status_counts.items():
        if k not in by_status:
            by_status[k] = v

    open_count = sum(by_status.get(s, 0) for s in ["OPEN", "ASSIGNED", "IN_PROGRESS", "ESCALATED"])
    resolved_count = sum(by_status.get(s, 0) for s in ["RESOLVED", "CLOSED"])

    priority_counts = dict(
        db.query(Ticket.priority, func.count(Ticket.id))
        .group_by(Ticket.priority)
        .all()
    )
    by_priority = {p: priority_counts.get(p, 0) for p in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]}
    for k, v in priority_counts.items():
        if k not in by_priority:
            by_priority[k] = v

    category_counts = dict(
        db.query(Ticket.category, func.count(Ticket.id))
        .group_by(Ticket.category)
        .all()
    )
    by_category = {c: category_counts.get(c, 0) for c in ["Hardware", "Software", "Network", "Access", "Other"]}
    for k, v in category_counts.items():
        if k not in by_category:
            by_category[k] = v

    return {
        "total_tickets": total,
        "total": total,
        "open": open_count,
        "resolved_or_closed": resolved_count,
        "by_status": by_status,
        "by_priority": by_priority,
        "by_category": by_category,
    }


def asset_report(db: Session):
    status_counts = dict(
        db.query(Asset.status, func.count(Asset.id))
        .group_by(Asset.status)
        .all()
    )
    by_status = {s: status_counts.get(s, 0) for s in ["AVAILABLE", "ASSIGNED", "UNDER_REPAIR", "RETIRED", "LOST"]}
    for k, v in status_counts.items():
        if k not in by_status:
            by_status[k] = v

    type_counts = dict(
        db.query(Asset.asset_type, func.count(Asset.id))
        .group_by(Asset.asset_type)
        .all()
    )
    by_type = {t: type_counts.get(t, 0) for t in ["Laptop", "Monitor", "Keyboard", "Mouse", "Printer"]}
    for k, v in type_counts.items():
        if k not in by_type:
            by_type[k] = v

    total = db.query(Asset).count()
    return {
        "total_assets": total,
        "total": total,
        "by_status": by_status,
        "by_type": by_type,
    }


def sla_report(db: Session):
    from datetime import datetime
    tickets = db.query(Ticket).all()
    total = len(tickets)
    breached = 0
    active = 0
    resolution_hours_list = []
    now = datetime.utcnow()

    for ticket in tickets:
        if ticket.sla_deadline:
            is_breached = False
            if ticket.status in {"RESOLVED", "CLOSED"}:
                if ticket.is_sla_breached:
                    is_breached = True
                elif ticket.resolved_at:
                    is_breached = ticket.resolved_at > ticket.sla_deadline
                elif ticket.closed_at:
                    is_breached = ticket.closed_at > ticket.sla_deadline
            else:
                active += 1
                is_breached = now > ticket.sla_deadline

            if is_breached:
                breached += 1

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
        support_users = self.db.query(User).filter(User.role.in_(["SUPPORT", "ADMIN"])).all()
        results = []
        for su in support_users:
            tickets = self.db.query(Ticket).filter(Ticket.assigned_to_id == su.id).all()
            total = len(tickets)
            if total == 0 and su.role == "ADMIN":
                continue
            completed = sum(1 for t in tickets if t.status in {"RESOLVED", "CLOSED"})
            pending = sum(1 for t in tickets if t.status in {"ASSIGNED", "OPEN", "ESCALATED"})
            processing = sum(1 for t in tickets if t.status == "IN_PROGRESS")
            results.append({
                "id": su.id,
                "name": su.name,
                "user_code": su.user_code,
                "role": su.role,
                "total_assigned": total,
                "completed": completed,
                "pending": pending,
                "processing": processing,
            })
        return results

    def stream_tickets_csv(self) -> Generator[str, None, None]:
        tickets = self.db.query(Ticket).order_by(Ticket.id.desc()).all()
        yield "ticket_id,title,category,priority,status,created_by,assigned_to,asset,created_at,sla_deadline,resolved_at,resolution\n"
        for t in tickets:
            t_num = getattr(t, "ticket_number", getattr(t, "ticket_id", str(t.id)))
            title = (t.title or "").replace(",", " ").replace("\n", " ").replace("\r", " ")
            cat = t.category or ""
            pri = t.priority or ""
            status = t.status or ""
            creator = (t.creator.name if t.creator else "").replace(",", " ")
            assignee = (t.assignee.name if t.assignee else "").replace(",", " ")
            asset_info = (f"{t.asset.asset_tag} {t.asset.brand} {t.asset.model}" if t.asset else "").replace(",", " ")
            created_at = t.created_at.strftime("%Y-%m-%d %H:%M:%S") if t.created_at else ""
            deadline = t.sla_deadline.strftime("%Y-%m-%d %H:%M:%S") if t.sla_deadline else ""
            resolved_at = t.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if t.resolved_at else ""
            res = (t.resolution_comment or "").replace(",", " ").replace("\n", " ").replace("\r", " ")
            yield f"{t_num},{title},{cat},{pri},{status},{creator},{assignee},{asset_info},{created_at},{deadline},{resolved_at},{res}\n"

    def stream_assets_csv(self) -> Generator[str, None, None]:
        assets = self.db.query(Asset).order_by(Asset.id.asc()).all()
        yield "asset_tag,asset_type,brand,model,serial_number,status,assigned_to,purchase_date,notes\n"
        for a in assets:
            tag = a.asset_tag or ""
            atype = a.asset_type or ""
            brand = (a.brand or "").replace(",", " ")
            model = (a.model or "").replace(",", " ")
            sn = a.serial_number or ""
            status = a.status or ""
            assigned = (f"{a.assigned_user.name} ({a.assigned_user.user_code})" if a.assigned_user else "").replace(",", " ")
            pdate = a.purchase_date.strftime("%Y-%m-%d") if a.purchase_date else ""
            notes = (a.notes or "").replace(",", " ").replace("\n", " ").replace("\r", " ")
            yield f"{tag},{atype},{brand},{model},{sn},{status},{assigned},{pdate},{notes}\n"
