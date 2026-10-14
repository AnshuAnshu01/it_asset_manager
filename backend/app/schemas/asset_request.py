from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

from app.schemas.asset import UserSummary, AssetResponse


class AssetRequestCreate(BaseModel):
    asset_type: str = Field(..., pattern="^(Laptop|Monitor|Keyboard|Mouse|Printer)$")
    preferred_specs: Optional[str] = Field(None, max_length=500)
    reason: str = Field(..., min_length=3, max_length=1000)
    priority: Optional[str] = Field("MEDIUM", pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")


class AssetRequestAssign(BaseModel):
    asset_id: int
    admin_notes: Optional[str] = Field(None, max_length=500)


class AssetRequestReject(BaseModel):
    admin_notes: Optional[str] = Field(None, max_length=500)


class AssetRequestResponse(BaseModel):
    id: int
    request_number: str
    user_id: int
    user: Optional[UserSummary] = None
    asset_type: str
    preferred_specs: Optional[str] = None
    reason: str
    priority: str
    status: str
    assigned_asset_id: Optional[int] = None
    assigned_asset: Optional[AssetResponse] = None
    assigned_by_id: Optional[int] = None
    assigned_by: Optional[UserSummary] = None
    admin_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
