import base64
import hashlib
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy.orm import Session
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, APP_ENV
from app.database.connection import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, UserCreate, UserResponse
from app.services.user_service import create_user, verify_password
from app.api.deps import get_current_user, require_roles, oauth2_scheme
from app.database.repositories import ActivityLogRepository

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Derive 256-bit AES key from SECRET_KEY for client-side password decryption
_AUTH_AES_KEY = hashlib.sha256((SECRET_KEY or "8f7K@2mL:91xPq$4vN!6zR").encode("utf-8")).digest()
_AUTH_AESGCM = AESGCM(_AUTH_AES_KEY)


def decrypt_password(password_str: str) -> str:
    """
    Decrypts client-side encrypted password (enc:v1:...) back to the original plain password.
    If already plain text (e.g. Swagger UI or automated scripts), returns as-is.
    """
    if not password_str or not isinstance(password_str, str):
        return ""
    if password_str.startswith("enc:v1:"):
        try:
            b64_data = password_str[len("enc:v1:"):]
            raw_bytes = base64.b64decode(b64_data)
            iv = raw_bytes[:12]
            ciphertext = raw_bytes[12:]
            decrypted = _AUTH_AESGCM.decrypt(iv, ciphertext, None)
            return decrypted.decode("utf-8")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Password decryption failed: {str(e)}"
            )
    return password_str


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
                            "password": {"type": "string", "title": "Encrypted or Plain Password"},
                        },
                        "required": ["username", "password"],
                    }
                },
                "application/x-www-form-urlencoded": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "username": {"type": "string", "title": "Username/Email"},
                            "password": {"type": "string", "title": "Password"},
                        },
                        "required": ["username", "password"],
                    }
                },
            },
            "required": True,
        }
    },
)
async def login(request: Request, response: Response, db: Session = Depends(get_db)):
    """
    Login Endpoint:
    - Frontend sends { username, password } where password is encrypted (enc:v1:...)
      so the original password never appears in Developer Tools Network Payload.
    - Server decrypts the password to the main plain password.
    - Server verifies the main password against the database bcrypt hash.
    - Establishes session via secure HttpOnly cookie & returns access token.
    """
    content_type = request.headers.get("content-type", "")
    client_ip = request.client.host if request.client else None

    if "application/json" in content_type:
        body = await request.json()
        raw_username = body.get("username", body.get("email", ""))
        raw_password = body.get("password", "")
    else:
        form = await request.form()
        raw_username = form.get("username", "")
        raw_password = form.get("password", "")

    username_clean = (raw_username or "").strip()

    # Decrypt client-encrypted password to main password
    plain_password = decrypt_password(raw_password or "")

    user = (
        db.query(User)
        .filter(
            (User.email.ilike(username_clean))
            | (User.user_code.ilike(username_clean))
        )
        .first()
    )

    if not user or not verify_password(plain_password, user.hashed_password):
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

    token = create_access_token(user)

    # Determine secure cookie flag: True if over HTTPS or running in production environment
    cookie_secure = (
        request.url.scheme == "https"
        or request.headers.get("x-forwarded-proto", "").lower() == "https"
        or APP_ENV.lower() not in ["dev", "test"]
    )
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=cookie_secure,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Clear the HttpOnly session cookie
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        samesite="lax",
    )

    client_ip = request.client.host if request.client else None
    ActivityLogRepository(db).log(
        action="USER_LOGOUT",
        user_id=current_user.id,
        details=f"User {current_user.email} logged out",
        ip_address=client_ip,
    )
    return {
        "message": (
            "Logout successful. Session cookie and access token cleared."
        )
    }

