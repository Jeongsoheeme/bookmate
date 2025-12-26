from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

class VenueCreate(BaseModel):
    name: str
    location: str
    seat_map: Dict[str, Any]  # 좌석 배치도 JSON
    capacity: Optional[int] = None

class VenueResponse(BaseModel):
    id: int
    name: str
    location: str
    seat_map: Dict[str, Any]
    capacity: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

