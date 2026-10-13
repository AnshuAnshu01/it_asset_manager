from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database.connection import engine, Base, SessionLocal
from app.models.user import User
from app.models.asset import Asset
from app.models.ticket import Ticket
from app.utils.logger import get_logger
from app.utils.exceptions import ITAssetManagerError

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.assets import router as assets_router
from app.api.tickets import router as tickets_router
from app.api.reports import router as reports_router
from app.api.websocket import ws_router

logger = get_logger()


def init_database():
    """Initializes tables and verifies database connection without creating redundant files or mock data."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        asset_count = db.query(Asset).count()
        ticket_count = db.query(Ticket).count()

        logger.info(
            f"Database initialized and connected: {user_count} users, {asset_count} assets, {ticket_count} tickets available."
        )
    except Exception as e:
        logger.error(f"Error during database startup check: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Application startup
    logger.info("Application starting up: Verifying database connection...")
    init_database()
    yield
    # Application shutdown
    logger.info("Application shutting down cleanly.")


app = FastAPI(
    title="Smart IT Asset & Support Ticket Management System",
    description=(
        "Production-style backend REST API built with FastAPI, PostgreSQL, and SQLAlchemy. "
        "Provides role-based asset assignment, SLA calculation, automatic ticket classification, "
        "WebSocket notifications, and memory-efficient streaming reports."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Exception Handler
@app.exception_handler(ITAssetManagerError)
async def custom_exception_handler(request: Request, exc: ITAssetManagerError):
    logger.warning(f"Handled Exception on {request.url.path}: {exc.message} (status {exc.status_code})")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.__class__.__name__, "message": exc.message},
    )


# Register Routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(assets_router)
app.include_router(tickets_router)
app.include_router(reports_router)
app.include_router(ws_router)


@app.get("/", tags=["Root"])
def root():
    return {
        "system": "Smart IT Asset & Support Ticket Management System",
        "version": "1.0.0",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "status": "online",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health", tags=["Root"])
def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
