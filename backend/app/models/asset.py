import enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship

from app.database.connection import Base


class AssetStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    ASSIGNED = "ASSIGNED"
    UNDER_REPAIR = "UNDER_REPAIR"
    RETIRED = "RETIRED"
    LOST = "LOST"


class AssetType(str, enum.Enum):
    LAPTOP = "Laptop"
    MONITOR = "Monitor"
    KEYBOARD = "Keyboard"
    MOUSE = "Mouse"
    PRINTER = "Printer"


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    asset_tag = Column(String(50), unique=True, index=True, nullable=False)  # e.g. LAP-1023
    asset_type = Column(String(50), index=True, nullable=False)             # Laptop, Monitor, etc.
    brand = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    serial_number = Column(String(100), unique=True, index=True, nullable=False)
    purchase_date = Column(Date, default=date.today, nullable=False)
    status = Column(String(30), default=AssetStatus.AVAILABLE.value, nullable=False, index=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    specifications = Column(JSON, nullable=True)  # Hardware specs
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    assigned_user = relationship("User", back_populates="assigned_assets", foreign_keys=[assigned_to_id])
    assignments = relationship("AssetAssignment", back_populates="asset", cascade="all, delete-orphan")
    tickets = relationship("Ticket", back_populates="asset")


class AssetAssignment(Base):
    __tablename__ = "asset_assignments"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    returned_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Flattened report columns requested by user
    laptop_sn = Column(String(100), nullable=True)
    monitor_sn = Column(String(100), nullable=True)
    keyboard_sn = Column(String(100), nullable=True)
    mouse_sn = Column(String(100), nullable=True)
    pc_sn = Column(String(100), nullable=True)

    # Relationships
    asset = relationship("Asset", back_populates="assignments")
    user = relationship("User", back_populates="asset_history", foreign_keys=[user_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
