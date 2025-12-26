from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Venue(Base):
    __tablename__ = "venues"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)  # 공연장 이름
    location = Column(String, nullable=False)  # 공연장 위치
    seat_map = Column(JSON, nullable=False)  # 좌석 배치도
    capacity = Column(Integer)  # 수용 인원 (선택적)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    events = relationship("Event", back_populates="venue")

