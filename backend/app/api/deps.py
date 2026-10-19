from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.services.user_service import UserService
from app.utils.exceptions import AuthenticationError, AuthorizationError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    # 1. Prefer HttpOnly cookie, fall back to Authorization header
    cookie_token = request.cookies.get("access_token")
    auth_token = cookie_token or token

    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Missing authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_service = UserService(db)
    try:
        payload = user_service.decode_token(auth_token)
        user_id = int(payload.get("sub"))
        user = user_service.get_user_by_id(user_id)
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user account",
            )
        return user
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_roles(*roles):
    def dependency(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission for this operation",
            )
        return current_user

    return dependency


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


def require_support_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["ADMIN", "SUPPORT"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IT Support or Admin privileges required",
        )
    return current_user
