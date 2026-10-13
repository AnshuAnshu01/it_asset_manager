from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.assets import router as assets_router
from app.api.tickets import router as tickets_router
from app.api.reports import router as reports_router
from app.api.websocket import ws_router

__all__ = [
    "auth_router",
    "users_router",
    "assets_router",
    "tickets_router",
    "reports_router",
    "ws_router",
]
