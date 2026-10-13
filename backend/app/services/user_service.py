import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.schemas.user import UserRegister, UserCreate, UserUpdate
from app.database.repositories import UserRepository, ActivityLogRepository
from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.utils.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ResourceNotFoundError,
    ITAssetManagerError,
)
from app.utils.decorators import log_activity, measure_execution_time

JWT_ALGORITHM = ALGORITHM or "HS256"
JWT_EXPIRATION_HOURS = 24


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Standalone password verification."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_user(db: Session, data: UserCreate, admin: Optional[User] = None) -> User:
    """Create user with validation and activity logging."""
    service = UserService(db)

    # Validate email uniqueness
    existing_user = service.user_repo.get_by_email(data.email)
    if existing_user:
        raise ITAssetManagerError("User with this email already exists", status_code=400)

    # Generate or validate unique user code
    user_code = data.user_code
    if user_code:
        if service.user_repo.get_by_user_code(user_code):
            raise ITAssetManagerError(f"User code '{user_code}' already exists", status_code=400)
    else:
        user_code = service._generate_user_code(data.role)

    hashed_pw = service.hash_password(data.password)

    user = User(
        user_code=user_code,
        name=data.name.strip(),
        email=data.email.lower().strip(),
        hashed_password=hashed_pw,
        role=data.role,
        department=data.department,
    )
    created = service.user_repo.create(user)

    actor_id = admin.id if admin else created.id
    service.activity_repo.log(
        action="ADMIN_CREATED_USER" if admin else "USER_REGISTERED",
        user_id=actor_id,
        details=(
            f"Admin {admin.email} created user {created.name} ({created.email}, {created.role}, {created.user_code})"
            if admin
            else f"User {created.name} ({created.email}, {created.role}) registered"
        ),
    )
    return created


def update_user(db: Session, user: User, data: UserUpdate, actor: Optional[User] = None) -> User:
    """Update user with activity logging."""
    changes = []
    if data.name is not None and data.name != user.name:
        changes.append(f"name: '{user.name}' -> '{data.name}'")
        user.name = data.name
    if data.department is not None and data.department != user.department:
        changes.append(f"department: '{user.department}' -> '{data.department}'")
        user.department = data.department
    if data.role is not None and data.role != user.role:
        changes.append(f"role: '{user.role}' -> '{data.role}'")
        user.role = data.role
    if data.is_active is not None and data.is_active != user.is_active:
        changes.append(f"status: {'active' if data.is_active else 'inactive'}")
        user.is_active = data.is_active

    db.commit()
    db.refresh(user)

    if changes:
        actor_id = actor.id if actor else user.id
        ActivityLogRepository(db).log(
            action="USER_UPDATED",
            user_id=actor_id,
            details=f"Updated user {user.email}: {', '.join(changes)}",
        )
    return user


class UserService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.activity_repo = ActivityLogRepository(db)

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password securely with bcrypt."""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return verify_password(plain_password, hashed_password)

    @staticmethod
    def create_access_token(user: User) -> str:
        """Generate JWT access token."""
        expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "username": getattr(user, "username", user.email),
            "role": user.role,
            "user_code": user.user_code,
            "exp": expire,
        }
        return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)

    @staticmethod
    def decode_token(token: str) -> dict:
        """Decode and validate JWT access token."""
        try:
            return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        except jwt.PyJWTError:
            raise AuthenticationError("Could not validate credentials / expired token")

    def _generate_user_code(self, role: str) -> str:
        prefix = "ADM" if role == "ADMIN" else ("SUP" if role == "SUPPORT" else "EMP")
        count = self.user_repo.count_users() + 101
        code = f"{prefix}-{count}"
        while self.user_repo.get_by_user_code(code):
            count += 1
            code = f"{prefix}-{count}"
        return code

    @measure_execution_time
    @log_activity("User Registration")
    def register_user(self, data: UserRegister) -> User:
        existing = self.user_repo.get_by_email(data.email)
        if existing:
            raise ITAssetManagerError("User with this email already exists", status_code=400)

        user_code = self._generate_user_code(data.role)
        hashed_pw = self.hash_password(data.password)

        user = User(
            user_code=user_code,
            name=data.name,
            email=data.email.lower().strip(),
            hashed_password=hashed_pw,
            role=data.role,
            department=data.department,
        )
        created = self.user_repo.create(user)
        self.activity_repo.log(
            action="USER_REGISTERED",
            user_id=created.id,
            details=f"User {created.email} ({created.role}) registered",
        )
        return created

    def authenticate_user(self, email: str, password: str) -> User:
        user = self.user_repo.get_by_email(email.strip())
        if not user or not self.verify_password(password, user.hashed_password):
            raise AuthenticationError("Incorrect email or password")
        if not user.is_active:
            raise AuthenticationError("User account is disabled")

        self.activity_repo.log(
            action="USER_LOGIN",
            user_id=user.id,
            details=f"Successful login for {user.email}",
        )
        return user

    def get_user_by_id(self, user_id: int) -> User:
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise ResourceNotFoundError(f"User with id {user_id} not found")
        return user

    def list_users(self, skip: int = 0, limit: int = 100, role: Optional[str] = None) -> List[User]:
        return self.user_repo.list_users(skip=skip, limit=limit, role=role)

    def create_user_by_admin(self, data: UserCreate, admin: User) -> User:
        existing = self.user_repo.get_by_email(data.email)
        if existing:
            raise ITAssetManagerError("User email already exists", status_code=400)

        code = data.user_code or self._generate_user_code(data.role)
        hashed_pw = self.hash_password(data.password)

        user = User(
            user_code=code,
            name=data.name,
            email=data.email.lower().strip(),
            hashed_password=hashed_pw,
            role=data.role,
            department=data.department,
        )
        created = self.user_repo.create(user)
        self.activity_repo.log(
            action="ADMIN_CREATED_USER",
            user_id=admin.id,
            details=f"Admin {admin.email} created user {created.email}",
        )
        return created

    def update_user(self, user_id: int, data: UserUpdate, actor: User) -> User:
        user = self.get_user_by_id(user_id)
        return update_user(self.db, user, data)

    def delete_user(self, user_id: int, actor: User) -> None:
        user = self.get_user_by_id(user_id)
        if user.id == actor.id:
            raise ITAssetManagerError("You cannot delete your own account", status_code=400)
        self.user_repo.delete(user)
        self.activity_repo.log(
            action="USER_DELETED",
            user_id=actor.id,
            details=f"User {user.email} deleted by {actor.email}",
        )
