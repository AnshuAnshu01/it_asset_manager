from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, require_roles
from app.database.connection import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate, UserPasswordReset
from app.services.user_service import create_user, update_user, UserService
from app.database.repositories import ActivityLogRepository

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN")),
):
    return db.query(User).all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/", response_model=UserResponse, status_code=201)
def add_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    return create_user(db, data, admin=admin)


@router.put("/{user_id}", response_model=UserResponse)
def edit_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return update_user(db, user, data, actor=admin)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    db.commit()

    ActivityLogRepository(db).log(
        action="USER_DEACTIVATED",
        user_id=admin.id,
        details=f"Admin {admin.email} deactivated user {user.email} ({user.user_code})",
    )

    return {"message": "User deactivated"}


@router.put("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    data: UserPasswordReset,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = UserService.hash_password(data.new_password)
    db.commit()

    ActivityLogRepository(db).log(
        action="PASSWORD_RESET",
        user_id=admin.id,
        details=f"Admin {admin.email} reset password for user {user.email} ({user.user_code})",
    )

    return {"message": "Password reset successfully"}

