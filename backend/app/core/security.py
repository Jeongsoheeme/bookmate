from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from typing import Optional
import secrets
import hashlib
import bcrypt
from app.core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
  password_hash_bytes = hashlib.sha256(plain_password.encode('utf-8')).digest()
  return bcrypt.checkpw(password_hash_bytes, hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
  password_hash_bytes = hashlib.sha256(password.encode('utf-8')).digest()
  hashed = bcrypt.hashpw(password_hash_bytes, bcrypt.gensalt())
  return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: timedelta = None):
  to_encode = data.copy()

  if expires_delta:
    expire = datetime.now(timezone.utc) + expires_delta
  else:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

  to_encode.update({"exp": expire, "type": "access"})  
  encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
  return encoded_jwt

def create_refresh_token() -> tuple[str, datetime]:
  token = secrets.token_urlsafe(32)
  expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
  return token, expires_at

def verify_token(token: str, token_type: str = "access") -> Optional[dict]:
  try:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    
    if payload.get("type") != token_type:
      return None
      
    return payload

  except JWTError:
    return None
