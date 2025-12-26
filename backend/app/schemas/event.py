from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.models.event import EventGenre, EventSubGenre, TicketReceiptMethod
from app.models.ticket import TicketGrade

class EventScheduleCreate(BaseModel):
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    running_time: Optional[int] = None  # 분 단위

class EventScheduleResponse(BaseModel):
    id: int
    event_id: int
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    running_time: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class EventSeatGradeCreate(BaseModel):
    row: str  # 행 (예: "A", "B")
    grade: TicketGrade
    price: float

class EventSeatGradeResponse(BaseModel):
    id: int
    event_id: int
    row: str
    grade: TicketGrade
    price: float
    created_at: datetime

    class Config:
        from_attributes = True

class EventDescriptionImageResponse(BaseModel):
    id: int
    event_id: int
    image_path: str
    order: int
    created_at: datetime

    class Config:
        from_attributes = True

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    genre: Optional[EventGenre] = None
    sub_genre: Optional[EventSubGenre] = None
    is_hot: Optional[int] = 0
    venue_id: int
    ticket_receipt_method: Optional[TicketReceiptMethod] = None
    sales_open_date: Optional[datetime] = None
    sales_end_date: Optional[datetime] = None
    schedules: List[EventScheduleCreate] = []
    seat_grades: List[EventSeatGradeCreate] = []
    # poster_image와 description_images는 파일 업로드로 직접 받으므로 여기서 제외

class EventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    genre: Optional[EventGenre] = None
    sub_genre: Optional[EventSubGenre] = None
    is_hot: Optional[int] = 0
    poster_image: Optional[str] = None
    venue_id: int
    ticket_receipt_method: Optional[TicketReceiptMethod] = None
    sales_open_date: Optional[datetime] = None
    sales_end_date: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    schedules: List[EventScheduleResponse] = []
    seat_grades: List[EventSeatGradeResponse] = []
    description_images: List[EventDescriptionImageResponse] = []

    class Config:
        from_attributes = True
