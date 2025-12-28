from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
  email: EmailStr
  username: str
  password: str

class UserLogin(BaseModel):
  email: EmailStr
  password: str

class UserResponse(BaseModel):
  id: int
  email: str
  username: str
  is_active: bool
  is_admin: bool
  phone1: Optional[str] = None
  phone2: Optional[str] = None
  phone3: Optional[str] = None
  postal_code: Optional[str] = None
  address: Optional[str] = None
  detail_address: Optional[str] = None
  created_at: datetime

  class Config:
    from_attributes = True

class UserUpdate(BaseModel):
  username: Optional[str] = None
  phone1: Optional[str] = None
  phone2: Optional[str] = None
  phone3: Optional[str] = None
  postal_code: Optional[str] = None
  address: Optional[str] = None
  detail_address: Optional[str] = None

class Token(BaseModel):
  access_token: str
  refresh_token: str
  token_type: str = "bearer"

class TokenData(BaseModel):
  email: Optional[str] = None

class RefreshTokenRequest(BaseModel):
  refresh_token: str
