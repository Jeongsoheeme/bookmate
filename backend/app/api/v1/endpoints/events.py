from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.event import Event
from app.schemas.event import EventResponse

router = APIRouter()

@router.get("/", response_model=List[EventResponse])
def get_all_events(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """모든 사용자가 접근 가능한 이벤트 목록 조회 (인증 불필요)"""
    events = db.query(Event).offset(skip).limit(limit).all()
    return events

