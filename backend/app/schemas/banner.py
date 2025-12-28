from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.schemas.event import EventResponse
from app.models.event import EventGenre

class BannerCreate(BaseModel):
    order: int
    event_id: int
    genre: Optional[EventGenre] = None
    link: Optional[str] = None
    exposure_start: Optional[datetime] = None
    exposure_end: Optional[datetime] = None

class BannerUpdate(BaseModel):
    order: Optional[int] = None
    event_id: Optional[int] = None
    genre: Optional[EventGenre] = None
    link: Optional[str] = None
    exposure_start: Optional[datetime] = None
    exposure_end: Optional[datetime] = None

class BannerResponse(BaseModel):
    id: int
    order: int
    event_id: int
    genre: Optional[EventGenre] = None
    link: Optional[str] = None
    exposure_start: Optional[datetime] = None
    exposure_end: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    event: Optional[EventResponse] = None

    class Config:
        from_attributes = True

