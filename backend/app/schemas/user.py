from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    department: str = Field(default="General", max_length=100)
    role: str = Field(default="EMPLOYEE", pattern="^(ADMIN|SUPPORT|EMPLOYEE)$")


class UserRegister(UserBase):
    password: str = Field(..., min_length=6, max_length=100)


class UserCreate(UserRegister):
    user_code: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(ADMIN|SUPPORT|EMPLOYEE)$")
    is_active: Optional[bool] = None


class UserPasswordReset(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=100)


class UserResponse(UserBase):
    id: int
    user_code: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserResponse] = None
