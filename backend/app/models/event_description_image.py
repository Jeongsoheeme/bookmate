from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class EventDescriptionImage(Base):
    """
    공연 작품 설명 이미지
    여러 개의 이미지를 업로드할 수 있음
    """
    __tablename__ = "event_description_images"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    image_path = Column(String, nullable=False)  # 이미지 파일 경로
    order = Column(Integer, nullable=False, default=0)  # 표시 순서
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="description_images")

