from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas import user
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.database import get_db
from app.models.user import User
from sqlalchemy.orm import Session
from app.core.security import get_password_hash
from app.core.security import verify_password
from app.core.config import settings
from datetime import timedelta, datetime, timezone
from app.core.security import create_access_token
from app.core.dependencies import get_current_user
from app.models.refresh_token import RefreshToken
from app.schemas.user import RefreshTokenRequest
from app.core.security import create_refresh_token

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)) -> User:

  existing_user = db.query(User).filter(User.email == user_data.email).first()
  if existing_user:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Email already registered"
    )

  existing_username = db.query(User).filter(User.username == user_data.username).first()
  if existing_username:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Username already taken"
    )

  hashed_password = get_password_hash(user_data.password)

  new_user = User(
    email=user_data.email,
    username=user_data.username,
    hashed_password=hashed_password
  )

  db.add(new_user)
  db.commit()
  db.refresh(new_user)

  return new_user

@router.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)) -> Token:
  user = db.query(User).filter(User.email == user_data.email).first()

  if user is None:
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Incorrect email or password"
    )

  if not verify_password(user_data.password, user.hashed_password):
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password"
    )


  if not user.is_active:
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Inactive user"
    )

  access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
  access_token = create_access_token(
    data={"sub": user.email},
    expires_delta=access_token_expires
  )

  refresh_token_str, expires_at = create_refresh_token()

  refresh_token_db = RefreshToken(
      token=refresh_token_str,
      user_id=user.id,
      expires_at=expires_at
  )
  db.add(refresh_token_db)
  db.commit()
  
  return {"access_token": access_token, "refresh_token": refresh_token_str, "token_type": "bearer"}

@router.post("/refresh", response_model=Token)
def refresh_access_token(
    token_request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
  refresh_token = db.query(RefreshToken).filter(
      RefreshToken.token == token_request.refresh_token
  ).first()
    
  if not refresh_token:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid refresh token"
    )

  if refresh_token.is_revoked:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token has been revoked"
    )
    
  if refresh_token.expires_at < datetime.now(timezone.utc):
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token has expired"
    )
    
  user = db.query(User).filter(User.id == refresh_token.user_id).first()
  if not user or not user.is_active:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="User not found or inactive"
    )
    
  access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
  new_access_token = create_access_token(
      data={"sub": user.email},
      expires_delta=access_token_expires
  )
    
  new_refresh_token_str, new_expires_at = create_refresh_token()
    
  refresh_token.is_revoked = True
    
  new_refresh_token = RefreshToken(
      token=new_refresh_token_str,
      user_id=user.id,
      expires_at=new_expires_at
  )
  db.add(new_refresh_token)
  db.commit()
    
  return {
      "access_token": new_access_token,
      "refresh_token": new_refresh_token_str,
      "token_type": "bearer"
  }

@router.post("/logout")
def logout(
    token_request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
  refresh_token = db.query(RefreshToken).filter(
      RefreshToken.token == token_request.refresh_token
  ).first()
    
  if refresh_token:
    refresh_token.is_revoked = True
    db.commit()
  
  return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
def get_current_user(current_user: User = Depends(get_current_user)) -> User:
  return current_user

@router.put("/me", response_model=UserResponse)
def update_current_user(
    user_update: user.UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """현재 사용자 정보 업데이트"""
    if user_update.username is not None:
        # username 중복 확인
        existing_user = db.query(User).filter(
            User.username == user_update.username,
            User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        current_user.username = user_update.username
    
    if user_update.phone1 is not None:
        current_user.phone1 = user_update.phone1
    if user_update.phone2 is not None:
        current_user.phone2 = user_update.phone2
    if user_update.phone3 is not None:
        current_user.phone3 = user_update.phone3
    if user_update.postal_code is not None:
        current_user.postal_code = user_update.postal_code
    if user_update.address is not None:
        current_user.address = user_update.address
    if user_update.detail_address is not None:
        current_user.detail_address = user_update.detail_address
    
    db.commit()
    db.refresh(current_user)
    return current_user
