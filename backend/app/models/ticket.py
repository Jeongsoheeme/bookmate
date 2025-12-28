from sqlalchemy import Column, Integer, ForeignKey, String, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class TicketGrade(str, enum.Enum):
  VIP = "VIP"
  R = "R"
  S = "S"
  A = "A"

class Ticket(Base):
  __tablename__ = "tickets"

  id = Column(Integer, primary_key=True, index=True)
  event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
  schedule_id = Column(Integer, ForeignKey("event_schedules.id"), nullable=True, index=True)  # 회차별 관리
  seat_section = Column(String)
  seat_row = Column(String)
  seat_number = Column(Integer)

  grade = Column(Enum(TicketGrade), nullable=False)
  price = Column(Float, nullable=False)

  event = relationship("Event", backref="tickets")
  schedule = relationship("EventSchedule", backref="tickets")
