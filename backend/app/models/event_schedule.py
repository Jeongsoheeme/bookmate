from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class EventSchedule(Base):
    __tablename__ = "event_schedules"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    start_datetime = Column(DateTime(timezone=True), nullable=False)
    end_datetime = Column(DateTime(timezone=True), nullable=True)  # 선택적
    running_time = Column(Integer, nullable=True)  # 러닝타임 (분 단위)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="schedules")

