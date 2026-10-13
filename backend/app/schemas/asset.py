from datetime import date, datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class AssetBase(BaseModel):
    asset_type: str = Field(..., pattern="^(Laptop|Monitor|Keyboard|Mouse|Printer)$")
    brand: str = Field(..., min_length=1, max_length=100)
    model: str = Field(..., min_length=1, max_length=100)
    serial_number: str = Field(..., min_length=3, max_length=100)
    purchase_date: Optional[date] = None
    specifications: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class AssetCreate(AssetBase):
    asset_tag: Optional[str] = None


class AssetUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(AVAILABLE|ASSIGNED|UNDER_REPAIR|RETIRED|LOST)$")
    specifications: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class AssetAssignRequest(BaseModel):
    user_id: int
    notes: Optional[str] = None


class AssetReturnRequest(BaseModel):
    notes: Optional[str] = None


class UserSummary(BaseModel):
    id: int
    name: str
    user_code: str
    email: str
    department: Optional[str] = None
    role: str

    model_config = ConfigDict(from_attributes=True)


class AssetResponse(AssetBase):
    id: int
    asset_tag: str
    status: str
    assigned_to_id: Optional[int] = None
    assigned_user: Optional[UserSummary] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssetAssignmentResponse(BaseModel):
    id: int
    asset_id: int
    user_id: int
    assigned_by_id: Optional[int]
    assigned_date: datetime
    returned_date: Optional[datetime]
    notes: Optional[str]

    model_config = ConfigDict(from_attributes=True)
