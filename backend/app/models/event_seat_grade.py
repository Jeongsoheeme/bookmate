from sqlalchemy import Column, Integer, String, Float, ForeignKey, Enum, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from app.models.ticket import TicketGrade

class EventSeatGrade(Base):
    """
    공연별 좌석 등급 및 가격 정보
    좌석배치도의 행(row)별로 등급과 가격을 지정할 수 있음
    """
    __tablename__ = "event_seat_grades"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("event_schedules.id"), nullable=True, index=True)  # 회차별 관리
    row = Column(String, nullable=False)  # 행 (예: "A", "B", "C")
    grade = Column(Enum(TicketGrade), nullable=False)  # 좌석 등급
    price = Column(Float, nullable=False)  # 가격
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="seat_grades")
    schedule = relationship("EventSchedule", backref="seat_grades")

