from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from app.utils.exceptions import SLAConfigurationError

SLA_HOURS = {
    "CRITICAL": 2,
    "HIGH": 4,
    "MEDIUM": 8,
    "LOW": 24,
}


def calculate_sla_deadline(priority: str, created_at: Optional[datetime] = None) -> datetime:
    """Standalone helper function to calculate SLA deadline."""
    created_at = created_at or datetime.utcnow()
    p_upper = (priority or "MEDIUM").upper()
    if p_upper not in SLA_HOURS:
        raise SLAConfigurationError(f"Unknown priority: {priority}")
    return created_at + timedelta(hours=SLA_HOURS[p_upper])


def get_sla_status(deadline: datetime, current_time: Optional[datetime] = None) -> Dict[str, Any]:
    """Standalone helper function to calculate SLA status."""
    current_time = current_time or datetime.utcnow()
    remaining = deadline - current_time
    return {
        "deadline": deadline,
        "breached": remaining.total_seconds() < 0,
        "remaining_seconds": max(0, int(remaining.total_seconds())),
    }


class SLAService:
    """
    SLA Management Service using Python datetime module as required by Section 7.
    """
    SLA_HOURS_MAP: Dict[str, int] = SLA_HOURS

    @classmethod
    def calculate_deadline(cls, priority: str, start_time: Optional[datetime] = None) -> datetime:
        return calculate_sla_deadline(priority, start_time)

    @classmethod
    def get_remaining_minutes(cls, deadline: datetime, current_time: Optional[datetime] = None) -> float:
        current_time = current_time or datetime.utcnow()
        diff = deadline - current_time
        return diff.total_seconds() / 60.0

    @classmethod
    def is_breached(cls, deadline: datetime, resolved_at: Optional[datetime] = None) -> bool:
        check_time = resolved_at if resolved_at else datetime.utcnow()
        return check_time > deadline

    @classmethod
    def calculate_resolution_time_hours(cls, created_at: datetime, resolved_at: datetime) -> float:
        if not resolved_at or resolved_at < created_at:
            return 0.0
        delta = resolved_at - created_at
        return delta.total_seconds() / 3600.0

    @classmethod
    def calculate_average_resolution_time(cls, resolution_times: List[float]) -> float:
        if not resolution_times:
            return 0.0
        return sum(resolution_times) / len(resolution_times)

    @classmethod
    def evaluate_ticket_sla_status(cls, ticket) -> Dict[str, Any]:
        now = datetime.utcnow()
        deadline = ticket.sla_deadline
        is_breached = cls.is_breached(deadline, ticket.resolved_at)
        remaining_mins = cls.get_remaining_minutes(deadline, now) if not ticket.resolved_at else 0.0

        return {
            "ticket_number": getattr(ticket, "ticket_number", getattr(ticket, "ticket_id", "")),
            "priority": ticket.priority,
            "created_at": ticket.created_at,
            "sla_deadline": deadline,
            "current_time": now,
            "remaining_minutes": round(remaining_mins, 1),
            "is_breached": is_breached,
            "status_label": "SLA BREACHED" if is_breached else ("RESOLVED" if ticket.resolved_at else "SLA ACTIVE"),
        }
