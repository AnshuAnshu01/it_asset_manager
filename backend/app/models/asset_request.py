import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.database.connection import Base


class AssetRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class AssetRequestPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AssetRequest(Base):
    __tablename__ = "asset_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_number = Column(String(50), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    asset_type = Column(String(50), nullable=False, index=True)
    preferred_specs = Column(Text, nullable=True)
    reason = Column(Text, nullable=False)
    priority = Column(String(20), default=AssetRequestPriority.MEDIUM.value, nullable=False)
    status = Column(String(30), default=AssetRequestStatus.PENDING.value, nullable=False, index=True)

    # Fulfillment by Admin
    assigned_asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    admin_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    assigned_asset = relationship("Asset", foreign_keys=[assigned_asset_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
