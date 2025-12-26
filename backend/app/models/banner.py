from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Banner(Base):
    __tablename__ = "banners"

    id = Column(Integer, primary_key=True, index=True)
    order = Column(Integer, nullable=False, default=0)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    link = Column(String, nullable=True)
    exposure_start = Column(DateTime(timezone=True), nullable=True)
    exposure_end = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    event = relationship("Event", back_populates="banners")

