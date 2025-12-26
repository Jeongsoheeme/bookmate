from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class EventGenre(str, enum.Enum):
    MUSICAL = "뮤지컬"
    THEATER = "연극"
    CONCERT = "콘서트"
    EXHIBITION = "전시"
    SPORTS = "스포츠"
    ETC = "기타"

class EventSubGenre(str, enum.Enum):
    BALLAD = "발라드"
    ROCK_METAL = "락/메탈"
    RAP_HIPHOP = "랩/힙합"
    JAZZ_SOUL = "재즈/소울"
    DINNER_SHOW = "디너쇼"
    FOLK_TROT = "포크/트로트"
    INTERNATIONAL = "내한공연"
    FESTIVAL = "페스티벌"
    FAN_CLUB = "팬클럽/팬미팅"
    INDIE = "인디"
    TALK_LECTURE = "토크/강연"

class TicketReceiptMethod(str, enum.Enum):
    DELIVERY = "배송"
    ON_SITE = "현장수령"
    BOTH = "배송,현장수령"

class Event(Base):
  __tablename__ = "events"

  id = Column(Integer, primary_key=True, index=True)
  title = Column(String, nullable=False, index=True)
  description = Column(Text)
  location = Column(String)
  genre = Column(Enum(EventGenre), nullable=True)  # 공연 장르 (뮤지컬, 연극, 콘서트 등)
  sub_genre = Column(Enum(EventSubGenre), nullable=True)  # 세부 장르 (발라드, 락/메탈 등)
  is_hot = Column(Integer, default=0)  # 요즘 HOT 여부 (0: 아니오, 1: 예)
  venue_id = Column(Integer, ForeignKey("venues.id"), nullable=False)
  poster_image = Column(String)
  ticket_receipt_method = Column(Enum(TicketReceiptMethod), nullable=True)  # 티켓 수령 방법
  sales_open_date = Column(DateTime(timezone=True), nullable=True)  # 판매 오픈 희망일
  sales_end_date = Column(DateTime(timezone=True), nullable=True)  # 판매 종료 희망일
  created_at = Column(DateTime(timezone=True), server_default=func.now())
  updated_at = Column(DateTime(timezone=True), onupdate=func.now())

  venue = relationship("Venue", back_populates="events")
  schedules = relationship("EventSchedule", back_populates="event", cascade="all, delete-orphan")
  seat_grades = relationship("EventSeatGrade", back_populates="event", cascade="all, delete-orphan")
  description_images = relationship("EventDescriptionImage", back_populates="event", cascade="all, delete-orphan")
  banners = relationship("Banner", back_populates="event", cascade="all, delete-orphan")
