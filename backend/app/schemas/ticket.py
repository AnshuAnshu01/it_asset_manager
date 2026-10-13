from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class TicketCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5)
    category: Optional[str] = Field(None, pattern="^(Hardware|Software|Network|Access|Other)$")
    priority: Optional[str] = Field(None, pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    asset_id: Optional[int] = None


class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = Field(None, pattern="^(Hardware|Software|Network|Access|Other)$")
    priority: Optional[str] = Field(None, pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")


class TicketAssignRequest(BaseModel):
    assigned_to_id: Optional[int] = None
    support_user_id: Optional[int] = None

    @property
    def target_id(self) -> Optional[int]:
        return self.support_user_id if self.support_user_id is not None else self.assigned_to_id


class TicketResolveRequest(BaseModel):
    resolution: Optional[str] = None
    resolution_comment: Optional[str] = None

    @property
    def comment_text(self) -> str:
        return self.resolution or self.resolution_comment or "Resolved"


class TicketCloseRequest(BaseModel):
    comments: Optional[str] = None


class TicketHistoryResponse(BaseModel):
    id: int
    ticket_id: int
    changed_by_id: Optional[int] = None
    changed_by_name: Optional[str] = None
    old_status: Optional[str] = None
    new_status: str
    comments: Optional[str] = None
    changed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TicketResponse(BaseModel):
    id: int
    ticket_number: str
    title: str
    description: str
    category: str
    priority: str
    status: str
    created_by_id: int
    creator_name: Optional[str] = None
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    asset_id: Optional[int] = None
    asset_name: Optional[str] = None
    created_at: datetime
    sla_deadline: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    resolution_comment: Optional[str] = None
    is_sla_breached: bool = False
    sla_remaining_minutes: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class TicketDetailResponse(TicketResponse):
    history: List[TicketHistoryResponse] = []


class TicketReportResponse(BaseModel):
    total_tickets: int
    by_status: dict
    by_priority: dict
    by_category: dict


class AssetReportResponse(BaseModel):
    total_assets: int
    by_status: dict
    by_type: dict


class SLAReportResponse(BaseModel):
    total_tickets: int
    breached_tickets: int
    compliance_rate_percent: float
    avg_resolution_time_hours: float


class ActivityLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_code: Optional[str] = None
    ticket_id: Optional[int] = None
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
