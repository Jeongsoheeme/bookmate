from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
  __tablename__ = "users"

  id = Column(Integer, primary_key=True, index=True)
  email = Column(String, unique=True, index=True, nullable=False)
  username = Column(String, unique=True, index=True, nullable=False)
  hashed_password = Column(String, nullable=False)
  is_active = Column(Boolean, default=True)
  is_admin = Column(Boolean, default=False)
  # 연락처 정보
  phone1 = Column(String, nullable=True)  # 010
  phone2 = Column(String, nullable=True)  # 중간 번호
  phone3 = Column(String, nullable=True)  # 마지막 번호
  # 배송지 정보
  postal_code = Column(String, nullable=True)
  address = Column(String, nullable=True)
  detail_address = Column(String, nullable=True)
  created_at = Column(DateTime(timezone=True), server_default=func.now())
  updated_at = Column(DateTime(timezone=True), onupdate=func.now())

  refresh_tokens = relationship("RefreshToken", back_populates="user")
