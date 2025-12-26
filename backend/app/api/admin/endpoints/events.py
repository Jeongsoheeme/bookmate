from fastapi import APIRouter, Depends, status, Form, File, UploadFile, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.models.event import Event, EventGenre, EventSubGenre, TicketReceiptMethod
from app.models.event_schedule import EventSchedule
from app.models.event_seat_grade import EventSeatGrade
from app.models.event_description_image import EventDescriptionImage
from app.models.venue import Venue
from app.schemas.event import EventResponse, EventScheduleCreate, EventSeatGradeCreate
from app.core.dependencies import get_current_admin
from app.services.file_upload import save_upload_file
import json

router = APIRouter()

@router.get("/", response_model=List[EventResponse])
def get_all_events(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    events = (
        db.query(Event)
        .options(
            joinedload(Event.schedules),
            joinedload(Event.seat_grades),
            joinedload(Event.description_images)
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return events

@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    genre: Optional[str] = Form(None),
    sub_genre: Optional[str] = Form(None),
    is_hot: Optional[int] = Form(0),
    venue_id: int = Form(...),
    ticket_receipt_method: Optional[str] = Form(None),
    sales_open_date: Optional[str] = Form(None),
    sales_end_date: Optional[str] = Form(None),
    schedules_json: str = Form("[]"),  # JSON 문자열로 받음
    seat_grades_json: str = Form("[]"),  # JSON 문자열로 받음
    poster_image: Optional[UploadFile] = File(None),
    description_images: List[UploadFile] = File([]),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    # venue_id 유효성 검사
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found"
        )
    
    # genre 파싱
    event_genre = None
    if genre:
        try:
            event_genre = EventGenre(genre)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid genre: {genre}"
            )
    
    # ticket_receipt_method 파싱
    receipt_method = None
    if ticket_receipt_method:
        try:
            receipt_method = TicketReceiptMethod(ticket_receipt_method)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid ticket_receipt_method: {ticket_receipt_method}"
            )
    
    # sales_open_date 파싱
    sales_open_datetime = None
    if sales_open_date:
        try:
            sales_open_datetime = datetime.fromisoformat(sales_open_date.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sales_open_date는 ISO 8601 형식이어야 합니다"
            )
    
    # sales_end_date 파싱
    sales_end_datetime = None
    if sales_end_date:
        try:
            sales_end_datetime = datetime.fromisoformat(sales_end_date.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sales_end_date는 ISO 8601 형식이어야 합니다"
            )
    
    # schedules 파싱
    schedules_data = []
    try:
        schedules_list = json.loads(schedules_json)
        for schedule_item in schedules_list:
            schedules_data.append(EventScheduleCreate(**schedule_item))
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid schedules_json: {str(e)}"
        )
    
    # seat_grades 파싱
    seat_grades_data = []
    try:
        seat_grades_list = json.loads(seat_grades_json)
        for grade_item in seat_grades_list:
            seat_grades_data.append(EventSeatGradeCreate(**grade_item))
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid seat_grades_json: {str(e)}"
        )
    
    # 파일 업로드 처리
    poster_image_path = None
    if poster_image:
        poster_image_path = save_upload_file(poster_image, subdirectory="events")
    
    # Event 생성
    new_event = Event(
        title=title,
        description=description,
        location=location,
        genre=event_genre,
        sub_genre=event_sub_genre,
        is_hot=is_hot_value,
        venue_id=venue_id,
        poster_image=poster_image_path,
        ticket_receipt_method=receipt_method,
        sales_open_date=sales_open_datetime,
        sales_end_date=sales_end_datetime
    )
    
    db.add(new_event)
    db.flush()  # ID를 얻기 위해 flush
    
    # 스케줄 생성
    for schedule_data in schedules_data:
        new_schedule = EventSchedule(
            event_id=new_event.id,
            start_datetime=schedule_data.start_datetime,
            end_datetime=schedule_data.end_datetime,
            running_time=schedule_data.running_time
        )
        db.add(new_schedule)
    
    # 좌석 등급 생성
    for seat_grade_data in seat_grades_data:
        new_seat_grade = EventSeatGrade(
            event_id=new_event.id,
            row=seat_grade_data.row,
            grade=seat_grade_data.grade,
            price=seat_grade_data.price
        )
        db.add(new_seat_grade)
    
    # 작품 설명 이미지 업로드
    if description_images:
        for idx, image_file in enumerate(description_images):
            image_path = save_upload_file(image_file, subdirectory="events/description")
            new_image = EventDescriptionImage(
                event_id=new_event.id,
                image_path=image_path,
                order=idx
            )
            db.add(new_image)
    
    db.commit()
    db.refresh(new_event)
    
    return new_event

@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    event = (
        db.query(Event)
        .options(
            joinedload(Event.schedules),
            joinedload(Event.seat_grades),
            joinedload(Event.description_images)
        )
        .filter(Event.id == event_id)
        .first()
    )
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    return event

@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    genre: Optional[str] = Form(None),
    sub_genre: Optional[str] = Form(None),
    is_hot: Optional[int] = Form(None),
    venue_id: int = Form(...),
    ticket_receipt_method: Optional[str] = Form(None),
    sales_open_date: Optional[str] = Form(None),
    sales_end_date: Optional[str] = Form(None),
    schedules_json: str = Form("[]"),
    seat_grades_json: str = Form("[]"),
    poster_image: Optional[UploadFile] = File(None),
    description_images: List[UploadFile] = File([]),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    # 이벤트 조회
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # venue_id 유효성 검사
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found"
        )
    
    # genre 파싱
    event_genre = None
    if genre:
        try:
            event_genre = EventGenre(genre)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid genre: {genre}"
            )
    
    # sub_genre 파싱
    event_sub_genre = None
    if sub_genre:
        try:
            event_sub_genre = EventSubGenre(sub_genre)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid sub_genre: {sub_genre}"
            )
    
    # ticket_receipt_method 파싱
    receipt_method = None
    if ticket_receipt_method:
        try:
            receipt_method = TicketReceiptMethod(ticket_receipt_method)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid ticket_receipt_method: {ticket_receipt_method}"
            )
    
    # sales_open_date 파싱
    sales_open_datetime = None
    if sales_open_date:
        try:
            sales_open_datetime = datetime.fromisoformat(sales_open_date.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sales_open_date는 ISO 8601 형식이어야 합니다"
            )
    
    # sales_end_date 파싱
    sales_end_datetime = None
    if sales_end_date:
        try:
            sales_end_datetime = datetime.fromisoformat(sales_end_date.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sales_end_date는 ISO 8601 형식이어야 합니다"
            )
    
    # schedules 파싱
    schedules_data = []
    try:
        schedules_list = json.loads(schedules_json)
        for schedule_item in schedules_list:
            schedules_data.append(EventScheduleCreate(**schedule_item))
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid schedules_json: {str(e)}"
        )
    
    # seat_grades 파싱
    seat_grades_data = []
    try:
        seat_grades_list = json.loads(seat_grades_json)
        for grade_item in seat_grades_list:
            seat_grades_data.append(EventSeatGradeCreate(**grade_item))
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid seat_grades_json: {str(e)}"
        )
    
    # 파일 업로드 처리 (새로운 파일이 업로드된 경우에만)
    if poster_image:
        poster_image_path = save_upload_file(poster_image, subdirectory="events")
        event.poster_image = poster_image_path
    
    # 이벤트 정보 업데이트
    event.title = title
    event.description = description
    event.location = location
    event.genre = event_genre
    if sub_genre is not None:
        event.sub_genre = event_sub_genre
    if is_hot is not None:
        event.is_hot = is_hot
    event.venue_id = venue_id
    event.ticket_receipt_method = receipt_method
    event.sales_open_date = sales_open_datetime
    event.sales_end_date = sales_end_datetime
    
    # 기존 스케줄 삭제 후 새로 생성
    db.query(EventSchedule).filter(EventSchedule.event_id == event_id).delete()
    for schedule_data in schedules_data:
        new_schedule = EventSchedule(
            event_id=event.id,
            start_datetime=schedule_data.start_datetime,
            end_datetime=schedule_data.end_datetime,
            running_time=schedule_data.running_time
        )
        db.add(new_schedule)
    
    # 기존 좌석 등급 삭제 후 새로 생성
    db.query(EventSeatGrade).filter(EventSeatGrade.event_id == event_id).delete()
    for seat_grade_data in seat_grades_data:
        new_seat_grade = EventSeatGrade(
            event_id=event.id,
            row=seat_grade_data.row,
            grade=seat_grade_data.grade,
            price=seat_grade_data.price
        )
        db.add(new_seat_grade)
    
    # 새로운 작품 설명 이미지가 업로드된 경우 추가
    if description_images:
        # 기존 이미지의 최대 order 값 찾기
        existing_images = db.query(EventDescriptionImage).filter(
            EventDescriptionImage.event_id == event_id
        ).all()
        max_order = max([img.order for img in existing_images], default=-1)
        
        for idx, image_file in enumerate(description_images):
            image_path = save_upload_file(image_file, subdirectory="events/description")
            new_image = EventDescriptionImage(
                event_id=event.id,
                image_path=image_path,
                order=max_order + 1 + idx
            )
            db.add(new_image)
    
    db.commit()
    db.refresh(event)
    
    return event
