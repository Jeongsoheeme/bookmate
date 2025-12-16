from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base

class Event(Base):
  __tablename__ = "events"

  id = Column(Integer, primary_key=True, index=True)
  title = Column(String, nullable=False, index=True)
  description = Column(Text)
  location = Column(String)
  event_date = Column(DateTime(timezone=True), nullable=False)
  poster_image = Column(String)
  seat_map = Column(JSON)
  created_at = Column(DateTime(timezone=True), server_default=func.now())
  updated_at = Column(DateTime(timezone=True), onupdate=func.now())
 