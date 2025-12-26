from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.models.banner import Banner
from app.models.event import Event
from app.schemas.banner import BannerCreate, BannerUpdate, BannerResponse
from app.core.dependencies import get_current_admin

router = APIRouter()

@router.get("/", response_model=List[BannerResponse])
def get_all_banners(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    banners = (
        db.query(Banner)
        .options(joinedload(Banner.event).joinedload(Event.schedules))
        .order_by(Banner.order)
        .all()
    )
    return banners

@router.get("/{banner_id}", response_model=BannerResponse)
def get_banner(
    banner_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    banner = (
        db.query(Banner)
        .options(joinedload(Banner.event).joinedload(Event.schedules))
        .filter(Banner.id == banner_id)
        .first()
    )
    if not banner:
        raise HTTPException(status_code=404, detail="배너를 찾을 수 없습니다")
    return banner

@router.post("/", response_model=BannerResponse, status_code=status.HTTP_201_CREATED)
def create_banner(
    banner_data: BannerCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    # 이벤트 존재 확인
    event = db.query(Event).filter(Event.id == banner_data.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")
    
    banner = Banner(
        order=banner_data.order,
        event_id=banner_data.event_id,
        link=banner_data.link,
        exposure_start=banner_data.exposure_start,
        exposure_end=banner_data.exposure_end,
    )
    db.add(banner)
    db.commit()
    db.refresh(banner)
    
    # 이벤트 정보를 포함하여 반환
    banner = (
        db.query(Banner)
        .options(joinedload(Banner.event).joinedload(Event.schedules))
        .filter(Banner.id == banner.id)
        .first()
    )
    return banner

@router.put("/{banner_id}", response_model=BannerResponse)
def update_banner(
    banner_id: int,
    banner_data: BannerUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    banner = db.query(Banner).filter(Banner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="배너를 찾을 수 없습니다")
    
    # 이벤트 존재 확인 (event_id가 변경되는 경우)
    if banner_data.event_id is not None:
        event = db.query(Event).filter(Event.id == banner_data.event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")
        banner.event_id = banner_data.event_id
    
    if banner_data.order is not None:
        banner.order = banner_data.order
    if banner_data.link is not None:
        banner.link = banner_data.link
    if banner_data.exposure_start is not None:
        banner.exposure_start = banner_data.exposure_start
    if banner_data.exposure_end is not None:
        banner.exposure_end = banner_data.exposure_end
    
    db.commit()
    
    # 이벤트 정보를 포함하여 반환
    banner = (
        db.query(Banner)
        .options(joinedload(Banner.event).joinedload(Event.schedules))
        .filter(Banner.id == banner_id)
        .first()
    )
    return banner

@router.delete("/{banner_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_banner(
    banner_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    banner = db.query(Banner).filter(Banner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="배너를 찾을 수 없습니다")
    
    db.delete(banner)
    db.commit()
    return None

@router.post("/delete-multiple", status_code=status.HTTP_204_NO_CONTENT)
def delete_banners(
    banner_ids: List[int],
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    banners = db.query(Banner).filter(Banner.id.in_(banner_ids)).all()
    for banner in banners:
        db.delete(banner)
    db.commit()
    return None

