from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime
from app.database import get_db
from app.models.banner import Banner
from app.models.event import Event
from app.schemas.banner import BannerResponse

router = APIRouter()

@router.get("/", response_model=List[BannerResponse])
def get_active_banners(
    db: Session = Depends(get_db)
):
    """노출 기간 내의 활성 배너 목록 조회 (인증 불필요)"""
    now = datetime.now()
    
    banners = (
        db.query(Banner)
        .options(joinedload(Banner.event).joinedload(Event.schedules))
        .filter(
            (Banner.exposure_start.is_(None) | (Banner.exposure_start <= now)),
            (Banner.exposure_end.is_(None) | (Banner.exposure_end >= now))
        )
        .order_by(Banner.order)
        .all()
    )
    return banners

