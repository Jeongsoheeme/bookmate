from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class BookingStatus(str, enum.Enum):
  PENDING = "pending"
  CONFIRMED = "confirmed"
  CANCELLED = "cancelled"

class Booking(Base):
  __tablename__ = "bookings"
  
  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
  ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
  schedule_id = Column(Integer, ForeignKey("event_schedules.id"), nullable=True, index=True)  # 회차별 관리
  
  status = Column(Enum(BookingStatus), default=BookingStatus.PENDING)
  total_price = Column(Float, nullable=False)
  
  payment_method = Column(String)
  transaction_id = Column(String)
  
  booked_at = Column(DateTime(timezone=True), server_default=func.now())
  
  user = relationship("User", backref="bookings")
  ticket = relationship("Ticket", backref="bookings")
  schedule = relationship("EventSchedule", backref="bookings")
  