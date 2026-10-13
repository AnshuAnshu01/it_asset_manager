from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.schemas.ticket import (
    TicketReportResponse,
    AssetReportResponse,
    SLAReportResponse,
)
from app.services.report_service import ReportService
from app.api.deps import require_support_or_admin, require_admin

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/tickets", response_model=TicketReportResponse)
def get_ticket_reports(
    current_user: User = Depends(require_support_or_admin),
    db: Session = Depends(get_db),
):
    """Aggregate ticket status, priority, and category metrics."""
    service = ReportService(db)
    return service.get_ticket_metrics()


@router.get("/assets", response_model=AssetReportResponse)
def get_asset_reports(
    current_user: User = Depends(require_support_or_admin),
    db: Session = Depends(get_db),
):
    """Aggregate asset status and type distribution."""
    service = ReportService(db)
    return service.get_asset_metrics()


@router.get("/sla", response_model=SLAReportResponse)
def get_sla_reports(
    current_user: User = Depends(require_support_or_admin),
    db: Session = Depends(get_db),
):
    """Calculate SLA compliance percentage and average resolution times."""
    service = ReportService(db)
    return service.get_sla_metrics()


@router.get("/support-workload")
def get_support_workload(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Aggregate support team workload metrics."""
    service = ReportService(db)
    return service.get_support_workload()


@router.get("/tickets/export-csv")
def export_tickets_csv(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Demonstrates Generator-Based Processing (Section 9):
    Streams ticket records without loading the entire dataset into memory.
    """
    service = ReportService(db)
    generator = service.stream_tickets_csv()
    return StreamingResponse(
        generator,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tickets_report.csv"},
    )


@router.get("/external-scenario-test")
def external_scenario_test(
    scenario: str = Query("success"),
    current_user: User = Depends(require_admin),
):
    """
    Demonstrates External API Integration scenarios (Section 14):
    Simulates external API scenarios (success, timeout, http_error, connection_error, invalid_response).
    """
    scenarios = {
        "success": {
            "scenario": "success",
            "status_code": 200,
            "message": "External API call completed successfully",
            "data": {"status": "ok", "service": "external_asset_verification"}
        },
        "timeout": {
            "scenario": "timeout",
            "status_code": 504,
            "message": "External API request timed out after 5.0 seconds",
            "data": None
        },
        "http_error": {
            "scenario": "http_error",
            "status_code": 502,
            "message": "External API returned 502 Bad Gateway response",
            "data": None
        },
        "connection_error": {
            "scenario": "connection_error",
            "status_code": 503,
            "message": "Failed to establish TCP connection with external service",
            "data": None
        },
        "invalid_response": {
            "scenario": "invalid_response",
            "status_code": 422,
            "message": "External API returned malformed or unexpected JSON structure",
            "data": None
        },
    }
    return scenarios.get(scenario, {"scenario": scenario, "status_code": 200, "message": "Unknown scenario"})
