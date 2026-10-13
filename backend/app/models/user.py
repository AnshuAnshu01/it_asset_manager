import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship, synonym

from app.database.connection import Base


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    SUPPORT = "SUPPORT"
    EMPLOYEE = "EMPLOYEE"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default=UserRole.EMPLOYEE.value, nullable=False)
    department = Column(String(100), default="General", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Synonyms for attribute and query compatibility
    username = synonym("email")
    password_hash = synonym("hashed_password")

    # Relationships
    assigned_assets = relationship("Asset", back_populates="assigned_user", foreign_keys="Asset.assigned_to_id")
    asset_history = relationship("AssetAssignment", back_populates="user", foreign_keys="AssetAssignment.user_id")
    tickets_created = relationship("Ticket", back_populates="creator", foreign_keys="Ticket.created_by_id")
    tickets_assigned = relationship("Ticket", back_populates="assignee", foreign_keys="Ticket.assigned_to_id")
    activity_logs = relationship("ActivityLog", back_populates="user")
