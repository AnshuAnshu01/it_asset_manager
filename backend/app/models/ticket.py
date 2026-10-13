import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship

from app.database.connection import Base


class TicketCategory(str, enum.Enum):
    HARDWARE = "Hardware"
    SOFTWARE = "Software"
    NETWORK = "Network"
    ACCESS = "Access"
    OTHER = "Other"


class TicketPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TicketStatus(str, enum.Enum):
    OPEN = "OPEN"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    ESCALATED = "ESCALATED"


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), default=TicketCategory.OTHER.value, nullable=False, index=True)
    priority = Column(String(20), default=TicketPriority.MEDIUM.value, nullable=False, index=True)
    status = Column(String(30), default=TicketStatus.OPEN.value, nullable=False, index=True)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    sla_deadline = Column(DateTime, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    resolution_comment = Column(Text, nullable=True)
    is_sla_breached = Column(Boolean, default=False, nullable=False)

    # Aliases for requirements document consistency
    @property
    def ticket_id(self) -> str:
        return self.ticket_number

    @property
    def created_by(self) -> int:
        return self.created_by_id

    @property
    def assigned_to(self):
        return self.assigned_to_id

    @property
    def created_date(self) -> datetime:
        return self.created_at

    @property
    def resolution(self):
        return self.resolution_comment

    @property
    def creator_name(self) -> str:
        return self.creator.name if self.creator else None

    @property
    def assigned_to_name(self) -> str:
        return self.assignee.name if self.assignee else None

    @property
    def asset_name(self) -> str:
        if self.asset:
            return f"{self.asset.brand} {self.asset.model} ({self.asset.asset_tag})"
        return None

    # Relationships
    creator = relationship("User", back_populates="tickets_created", foreign_keys=[created_by_id])
    assignee = relationship("User", back_populates="tickets_assigned", foreign_keys=[assigned_to_id])
    asset = relationship("Asset", back_populates="tickets")
    history = relationship(
        "TicketHistory",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="TicketHistory.changed_at.desc()",
    )
    activity_logs = relationship("ActivityLog", back_populates="ticket")


class TicketHistory(Base):
    __tablename__ = "ticket_history"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), default="STATUS_CHANGE", nullable=False)
    old_status = Column(String(30), nullable=True)
    new_status = Column(String(30), nullable=False)
    comments = Column(Text, nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    creator_name = Column(String(150), nullable=True)
    creator_user_code = Column(String(50), nullable=True)

    # Aliases
    @property
    def comment(self):
        return self.comments

    @property
    def created_at(self):
        return self.changed_at

    @property
    def changed_by_name(self) -> str:
        return self.changed_by.name if self.changed_by else None

    # Relationships
    ticket = relationship("Ticket", back_populates="history")
    changed_by = relationship("User", foreign_keys=[changed_by_id])


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user_code = Column(String(50), nullable=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=True, index=True)
    action = Column(String(150), nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="activity_logs")
    ticket = relationship("Ticket", back_populates="activity_logs")
