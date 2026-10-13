from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy.orm import Session

from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database.connection import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, UserCreate, UserResponse
from app.services.user_service import create_user, verify_password
from app.api.deps import get_current_user, require_roles, oauth2_scheme
from app.database.repositories import ActivityLogRepository

router = APIRouter(prefix="/auth", tags=["Authentication"])


def create_access_token(user: User):
    expires = datetime.utcnow() + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user.id),
        "username": getattr(user, "username", user.email),
        "role": user.role,
        "exp": expires,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)



@router.post(
    "/login",
    response_model=TokenResponse,
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "username": {"type": "string", "title": "Username/Email"},
                            "password": {"type": "string", "title": "Password"}
                        },
                        "required": ["username", "password"]
                    }
                },
                "application/x-www-form-urlencoded": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "username": {"type": "string", "title": "Username/Email"},
                            "password": {"type": "string", "title": "Password"}
                        },
                        "required": ["username", "password"]
                    }
                }
            },
            "required": True
        }
    }
)
async def login(request: Request, db: Session = Depends(get_db)):
    """
    Login endpoint supporting both JSON payload (LoginRequest)
    and form data (for Swagger UI Authorize button).
    """
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        raw_username = body.get("username", body.get("email", ""))
        raw_password = body.get("password", "")
    else:
        form = await request.form()
        raw_username = form.get("username", "")
        raw_password = form.get("password", "")

    username_clean = (raw_username or "").strip()
    password_clean = raw_password or ""
    client_ip = request.client.host if request.client else None

    user = (
        db.query(User)
        .filter(
            (User.email.ilike(username_clean))
            | (User.user_code.ilike(username_clean))
        )
        .first()
    )

    if not user or not verify_password(password_clean, user.hashed_password):
        ActivityLogRepository(db).log(
            action="LOGIN_FAILED",
            user_id=user.id if user else None,
            details=f"Failed login attempt for '{username_clean}'",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if not user.is_active:
        ActivityLogRepository(db).log(
            action="LOGIN_BLOCKED",
            user_id=user.id,
            details=f"Disabled user '{user.email}' attempted to login",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=401,
            detail="User account is disabled",
        )

    ActivityLogRepository(db).log(
        action="USER_LOGIN",
        user_id=user.id,
        details=f"Successful login for {user.email}",
        ip_address=client_ip,
    )

    return {
        "access_token": create_access_token(user),
        "token_type": "bearer",
        "user": user,
    }




@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else None
    ActivityLogRepository(db).log(
        action="USER_LOGOUT",
        user_id=current_user.id,
        details=f"User {current_user.email} logged out",
        ip_address=client_ip,
    )
    return {
        "message": (
            "Logout successful. Access token removed."
        )
    }

