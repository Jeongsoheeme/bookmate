from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select
from typing import List, Optional
from app.database import get_db
from app.models.ticket import Ticket, TicketGrade
from app.models.booking import Booking, BookingStatus
from app.models.event import Event
from app.models.event_schedule import EventSchedule
from app.models.event_seat_grade import EventSeatGrade
from app.models.venue import Venue
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.redis_service import redis_service
from pydantic import BaseModel

router = APIRouter()

class TicketResponse(BaseModel):
    id: int | None
    event_id: int
    seat_section: str | None
    seat_row: str | None
    seat_number: int | None
    grade: str
    price: float
    available: bool

    class Config:
        from_attributes = True

@router.get("/events/{event_id}/tickets", response_model=List[TicketResponse])
def get_event_tickets(
    event_id: int,
    schedule_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_queue_token: str | None = Header(None, alias="X-Queue-Token")
):
    """이벤트의 티켓 목록 조회
    인기 이벤트의 경우 대기열 토큰이 필요합니다.
    schedule_id가 제공되면 해당 회차의 티켓만 조회
    tickets 테이블에 데이터가 없으면 event_seat_grades를 기반으로 좌석을 생성"""
    from app.api.v1.endpoints.queue import validate_queue_token

    # 이벤트와 venue 정보 확인
    event = db.query(Event).options(joinedload(Event.venue)).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # 인기 이벤트인 경우 대기열 토큰 검증
    if event.is_hot or getattr(event, 'queue_enabled', False):
        if not x_queue_token:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "대기열 토큰 필요",
                    "message": "인기 이벤트는 대기열을 통과해야 합니다."
                }
            )

        if not validate_queue_token(event_id, current_user.id, x_queue_token):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "대기열 토큰 무효",
                    "message": "대기열 토큰이 만료되었거나 유효하지 않습니다."
                }
            )
    
    # schedule_id가 제공된 경우 해당 스케줄 확인
    if schedule_id:
        schedule = db.query(EventSchedule).filter(
            EventSchedule.id == schedule_id,
            EventSchedule.event_id == event_id
        ).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found for this event")
    
    # tickets 테이블에서 좌석 조회 (schedule_id 필터링)
    ticket_query = db.query(Ticket).filter(Ticket.event_id == event_id)
    if schedule_id:
        ticket_query = ticket_query.filter(Ticket.schedule_id == schedule_id)
    tickets = ticket_query.all()
    
    # tickets가 없으면 event_seat_grades를 기반으로 좌석 생성
    if not tickets:
        seat_grade_query = db.query(EventSeatGrade).filter(
            EventSeatGrade.event_id == event_id
        )
        if schedule_id:
            # schedule_id가 있으면 해당 회차의 좌석 등급만 조회
            # schedule_id가 null인 경우도 포함 (회차별로 지정되지 않은 경우)
            seat_grade_query = seat_grade_query.filter(
                (EventSeatGrade.schedule_id == schedule_id) | (EventSeatGrade.schedule_id.is_(None))
            )
        seat_grades = seat_grade_query.all()
        
        if not seat_grades:
            return []
        
        # venue의 seat_map에서 섹션 정보 추출
        section = None
        seats_per_row = 20  # 기본값
        
        if event.venue and event.venue.seat_map:
            seat_map = event.venue.seat_map
            # seat_map이 딕셔너리인 경우 섹션 정보 추출
            if isinstance(seat_map, dict):
                # 섹션 정보가 있는지 확인 (예: "sections", "sections_list", "default_section" 등)
                if "sections" in seat_map and isinstance(seat_map["sections"], list) and len(seat_map["sections"]) > 0:
                    section = seat_map["sections"][0]  # 첫 번째 섹션 사용
                elif "default_section" in seat_map:
                    section = seat_map["default_section"]
                elif "section" in seat_map:
                    section = seat_map["section"]
                
                # 행당 좌석 수 정보 확인
                if "seats_per_row" in seat_map:
                    seats_per_row = seat_map["seats_per_row"]
        
        # 섹션 정보가 없으면 기존 tickets에서 섹션 정보 확인
        if not section:
            existing_tickets = db.query(Ticket).filter(
                Ticket.event_id == event_id
            ).first()
            if existing_tickets and existing_tickets.seat_section:
                section = existing_tickets.seat_section
        
        # 여전히 섹션 정보가 없으면 기본값 사용
        if not section:
            section = "9구역"  # 기본 섹션
        
        # event_seat_grades의 row 정보를 기반으로 좌석 생성
        result = []
        
        for grade_info in seat_grades:
            row = grade_info.row
            # 각 행당 seats_per_row만큼 좌석 생성
            for seat_num in range(1, seats_per_row + 1):
                result.append(TicketResponse(
                    id=None,  # 실제 티켓 ID가 없으므로 None
                    event_id=event_id,
                    seat_section=section,
                    seat_row=f"{row}열",
                    seat_number=seat_num,
                    grade=grade_info.grade.value,
                    price=grade_info.price,
                    available=True  # 기본적으로 모두 예약 가능
                ))
        
        # 예약된 좌석 확인 (tickets 테이블이 없으므로 예약도 없을 것)
        return result
    
    # tickets 테이블에 데이터가 있는 경우
    # 실제 티켓을 기준으로 각 행의 좌석 범위를 파악하고, event_seat_grades를 참고하여 누락된 좌석 보완
    
    # 예약된 티켓 ID 확인 (schedule_id 필터링)
    booked_ticket_ids = set()
    if tickets:
        ticket_ids = [t.id for t in tickets if t.id is not None]
        if ticket_ids:
            booking_query = db.query(Booking).filter(
                Booking.ticket_id.in_(ticket_ids),
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
            )
            if schedule_id:
                booking_query = booking_query.filter(
                    (Booking.schedule_id == schedule_id) | (Booking.schedule_id.is_(None))
                )
            bookings = booking_query.all()
            booked_ticket_ids = {booking.ticket_id for booking in bookings}
    
    # 실제 티켓을 딕셔너리로 변환 (row, number로 조회)
    ticket_dict = {}
    row_max_seats = {}  # 각 행의 최대 좌석 번호
    row_info = {}  # 각 행의 등급, 가격 정보
    
    for ticket in tickets:
        key = (ticket.seat_row, ticket.seat_number)
        ticket_dict[key] = ticket
        
        # 각 행의 최대 좌석 번호 추적
        if ticket.seat_row:
            if ticket.seat_row not in row_max_seats:
                row_max_seats[ticket.seat_row] = 0
            if ticket.seat_number and ticket.seat_number > row_max_seats[ticket.seat_row]:
                row_max_seats[ticket.seat_row] = ticket.seat_number
            
            # 행 정보 저장
            if ticket.seat_row not in row_info:
                row_info[ticket.seat_row] = {
                    'grade': ticket.grade.value,
                    'price': ticket.price,
                    'section': ticket.seat_section
                }
    
    # event_seat_grades 조회 (누락된 행 정보 보완용, schedule_id 필터링)
    seat_grade_query = db.query(EventSeatGrade).filter(
        EventSeatGrade.event_id == event_id
    )
    if schedule_id:
        seat_grade_query = seat_grade_query.filter(
            (EventSeatGrade.schedule_id == schedule_id) | (EventSeatGrade.schedule_id.is_(None))
        )
    seat_grades = seat_grade_query.all()
    
    # seat_grades를 딕셔너리로 변환
    seat_grades_dict = {}
    for grade_info in seat_grades:
        row_key = f"{grade_info.row}열"
        seat_grades_dict[row_key] = {
            'grade': grade_info.grade.value,
            'price': grade_info.price
        }
    
    # venue의 seat_map에서 기본 정보 추출
    section = None
    seats_per_row = 20  # 기본값
    
    if event.venue and event.venue.seat_map:
        seat_map = event.venue.seat_map
        if isinstance(seat_map, dict):
            if "sections" in seat_map and isinstance(seat_map["sections"], list) and len(seat_map["sections"]) > 0:
                section = seat_map["sections"][0]
            elif "default_section" in seat_map:
                section = seat_map["default_section"]
            elif "section" in seat_map:
                section = seat_map["section"]
            
            if "seats_per_row" in seat_map:
                seats_per_row = seat_map["seats_per_row"]
    
    # 섹션 정보가 없으면 기존 tickets에서 섹션 정보 확인
    if not section and tickets:
        existing_ticket = tickets[0]
        if existing_ticket.seat_section:
            section = existing_ticket.seat_section
    
    if not section:
        section = "9구역"  # 기본 섹션
    
    # event_seat_grades에 정의된 모든 행을 기준으로 좌석 생성
    # 실제 티켓이 있는 행도 포함하되, seats_per_row를 우선 사용
    all_rows = set()
    
    # event_seat_grades에 있는 모든 행 추가
    for grade_info in seat_grades:
        row_key = f"{grade_info.row}열"
        all_rows.add(row_key)
    
    # 실제 티켓이 있는 행도 추가 (event_seat_grades에 없는 행일 수 있음)
    for row in row_max_seats.keys():
        all_rows.add(row)
    
    result = []
    for row in sorted(all_rows):
        # seats_per_row를 우선 사용 (venue의 seat_map 정보)
        # 실제 티켓이 있는 경우에도 seats_per_row를 기준으로 모든 좌석 생성
        max_seat = seats_per_row
        
        # 행 정보 가져오기 (실제 티켓 우선, 없으면 seat_grades)
        row_data = row_info.get(row)
        if not row_data:
            row_data = seat_grades_dict.get(row, {})
            if row_data:
                row_data['section'] = section
        
        grade = row_data.get('grade', 'A') if row_data else 'A'
        price = row_data.get('price', 0) if row_data else 0
        row_section = row_data.get('section', section) if row_data else section
        
        # 각 행의 모든 좌석 생성 (seats_per_row 기준)
        for seat_num in range(1, max_seat + 1):
            ticket_key = (row, seat_num)
            existing_ticket = ticket_dict.get(ticket_key)
            
            if existing_ticket:
                # 실제 티켓이 있으면 그 정보 사용
                result.append(TicketResponse(
                    id=existing_ticket.id,
                    event_id=event_id,
                    seat_section=existing_ticket.seat_section or row_section,
                    seat_row=existing_ticket.seat_row,
                    seat_number=existing_ticket.seat_number,
                    grade=existing_ticket.grade.value,
                    price=existing_ticket.price,
                    available=existing_ticket.id not in booked_ticket_ids if existing_ticket.id else True
                ))
            else:
                # 실제 티켓이 없으면 가상 티켓 생성
                # 단, seat_grades에 정의된 행만 생성
                if row in seat_grades_dict or row in row_info:
                    result.append(TicketResponse(
                        id=None,
                        event_id=event_id,
                        seat_section=row_section,
                        seat_row=row,
                        seat_number=seat_num,
                        grade=grade,
                        price=price,
                        available=True  # 아직 생성되지 않은 티켓은 예약 가능
                    ))
    
    return result


class SeatInfo(BaseModel):
    row: str
    number: int
    grade: str
    price: float
    seat_section: Optional[str] = None


class CreateBookingRequest(BaseModel):
    event_id: int
    schedule_id: Optional[int] = None
    seats: List[SeatInfo]
    total_price: float
    receipt_method: str  # "delivery" or "on_site"
    delivery_info: Optional[dict] = None


class SeatInfo(BaseModel):
    row: str
    number: int

class SeatLockRequest(BaseModel):
    event_id: int
    schedule_id: Optional[int] = None
    seats: List[SeatInfo]

class SeatLockResponse(BaseModel):
    success: bool
    message: str
    locked_seats: List[dict] = []

class BookingResponse(BaseModel):
    id: int
    user_id: int
    ticket_id: int
    status: str
    total_price: float
    booked_at: str

    class Config:
        from_attributes = True


@router.post("/seats/lock", response_model=SeatLockResponse)
def lock_seats(
    request: SeatLockRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_queue_token: str | None = Header(None, alias="X-Queue-Token")
):
    """
    좌석 선택 완료 시점에 미리 좌석을 잠그는 API
    예매 정보 입력 전에 좌석을 확보하여 다른 사용자가 선택하지 못하도록 함
    """
    from app.api.v1.endpoints.queue import validate_queue_token

    # 이벤트 확인 및 대기열 토큰 검증
    event = db.query(Event).filter(Event.id == request.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # 인기 이벤트인 경우 대기열 토큰 검증
    if event.is_hot or getattr(event, 'queue_enabled', False):
        if not x_queue_token:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "대기열 토큰 필요",
                    "message": "인기 이벤트는 대기열을 통과해야 합니다."
                }
            )

        if not validate_queue_token(request.event_id, current_user.id, x_queue_token):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "대기열 토큰 무효",
                    "message": "대기열 토큰이 만료되었거나 유효하지 않습니다."
                }
            )
    
    locked_tickets = []
    
    try:
        for seat_info in request.seats:
            # 티켓이 이미 존재하는지 확인
            ticket_query = db.query(Ticket).filter(
                Ticket.event_id == request.event_id,
                Ticket.seat_row == seat_info.row,
                Ticket.seat_number == seat_info.number
            )
            if request.schedule_id:
                ticket_query = ticket_query.filter(Ticket.schedule_id == request.schedule_id)
            existing_ticket = ticket_query.first()
            
            # 티켓 ID 결정
            if existing_ticket:
                ticket_id = existing_ticket.id
            else:
                # 임시 ID 생성 (일관성을 위해 절대값 사용)
                seat_key = f"{request.event_id}:{request.schedule_id or 0}:{seat_info.row}:{seat_info.number}"
                ticket_id = -abs(hash(seat_key)) % 1000000
            
            # Redis LOCK 시도
            lock_acquired = redis_service.try_lock_seat(ticket_id, user_id=current_user.id)
            
            # LOCK 실패 시, 같은 사용자가 이미 LOCK을 가지고 있는지 확인
            if not lock_acquired:
                lock_user_id = redis_service.get_lock_user_id(ticket_id)
                if lock_user_id is not None and lock_user_id == current_user.id:
                    lock_acquired = True
            
            if lock_acquired:
                locked_tickets.append({
                    "row": seat_info.row,
                    "number": seat_info.number,
                    "ticket_id": ticket_id
                })
            else:
                # 하나라도 실패하면 모든 LOCK 해제
                for locked in locked_tickets:
                    redis_service.unlock_seat(locked["ticket_id"])
                return SeatLockResponse(
                    success=False,
                    message=f"좌석 {seat_info.row}-{seat_info.number}번이 다른 사용자에 의해 처리 중입니다.",
                    locked_seats=[]
                )
        
        return SeatLockResponse(
            success=True,
            message=f"{len(locked_tickets)}개의 좌석이 잠금되었습니다.",
            locked_seats=locked_tickets
        )
    except Exception as e:
        # 오류 발생 시 모든 LOCK 해제
        for locked in locked_tickets:
            redis_service.unlock_seat(locked["ticket_id"])
        return SeatLockResponse(
            success=False,
            message=f"좌석 잠금 중 오류가 발생했습니다: {str(e)}",
            locked_seats=[]
        )


@router.post("/bookings", response_model=List[BookingResponse])
def create_bookings(
    request: CreateBookingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_queue_token: str | None = Header(None, alias="X-Queue-Token")
):
    """
    선택한 좌석에 대해 티켓을 생성하고 booking을 생성
    고트래픽 환경을 위한 다층 방어 전략:
    1. Redis 분산 LOCK (빠른 차단)
    2. DB 레벨 LOCK (최종 보장)
    3. 트랜잭션으로 원자성 보장
    """
    from app.api.v1.endpoints.queue import validate_queue_token

    # 이벤트 확인
    event = db.query(Event).filter(Event.id == request.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # 인기 이벤트인 경우 대기열 토큰 검증
    if event.is_hot or getattr(event, 'queue_enabled', False):
        if not x_queue_token:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "대기열 토큰 필요",
                    "message": "인기 이벤트는 대기열을 통과해야 합니다."
                }
            )

        if not validate_queue_token(request.event_id, current_user.id, x_queue_token):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "대기열 토큰 무효",
                    "message": "대기열 토큰이 만료되었거나 유효하지 않습니다."
                }
            )
    
    # schedule_id가 제공된 경우 해당 스케줄 확인
    if request.schedule_id:
        schedule = db.query(EventSchedule).filter(
            EventSchedule.id == request.schedule_id,
            EventSchedule.event_id == request.event_id
        ).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found for this event")
    
    created_bookings = []
    locked_tickets = []  # LOCK 획득한 티켓 ID 추적
    
    try:
        # 1단계: 모든 좌석에 대해 Redis LOCK 시도
        for seat_info in request.seats:
            # 티켓이 이미 존재하는지 확인 (row, number, event_id, schedule_id로)
            ticket_query = db.query(Ticket).filter(
                Ticket.event_id == request.event_id,
                Ticket.seat_row == seat_info.row,
                Ticket.seat_number == seat_info.number
            )
            if request.schedule_id:
                ticket_query = ticket_query.filter(Ticket.schedule_id == request.schedule_id)
            existing_ticket = ticket_query.first()
            
            # 티켓이 없으면 임시 ID 생성 (나중에 실제 생성)
            # 일관성을 위해 문자열을 정규화하고 절대값 사용
            if existing_ticket:
                ticket_id = existing_ticket.id
            else:
                # 임시 ID: 일관성을 위해 정규화된 문자열 사용
                seat_key = f"{request.event_id}:{request.schedule_id or 0}:{seat_info.row}:{seat_info.number}"
                # Python hash는 실행마다 다를 수 있으므로 절대값 사용
                ticket_id = -abs(hash(seat_key)) % 1000000
            
            # Redis LOCK 시도
            # 먼저 기존 LOCK을 확인
            lock_user_id = redis_service.get_lock_user_id(ticket_id)
            
            if lock_user_id is not None:
                if lock_user_id == current_user.id:
                    # 같은 사용자가 이미 LOCK을 가지고 있으면 재사용
                    lock_acquired = True
                else:
                    # 다른 사용자가 LOCK을 가지고 있음
                    # 타임아웃 대기 없이 바로 실패 처리
                    lock_acquired = False
            else:
                # LOCK이 없으면 새로 획득 시도
                lock_acquired = redis_service.try_lock_seat(ticket_id, user_id=current_user.id)
            
            if not lock_acquired:
                # LOCK 실패 시 이미 LOCK한 것들 해제
                for locked_id in locked_tickets:
                    redis_service.unlock_seat(locked_id)
                raise HTTPException(
                    status_code=409,
                    detail=f"좌석 {seat_info.row}-{seat_info.number}번이 다른 사용자에 의해 처리 중입니다. 다시 시도하시거나 다른 좌석을 선택해주세요."
                )
            
            locked_tickets.append(ticket_id)
        
        # 2단계: DB 트랜잭션 내에서 실제 예약 처리
        # 모든 좌석에 LOCK을 획득했으므로 이제 안전하게 처리 가능
        for seat_info in request.seats:
            # DB 레벨 LOCK으로 좌석 조회 (SELECT FOR UPDATE)
            ticket_query = db.query(Ticket).filter(
                Ticket.event_id == request.event_id,
                Ticket.seat_row == seat_info.row,
                Ticket.seat_number == seat_info.number
            )
            if request.schedule_id:
                ticket_query = ticket_query.filter(Ticket.schedule_id == request.schedule_id)
            
            # SELECT FOR UPDATE로 LOCK 획득
            ticket = ticket_query.with_for_update().first()
            
            # 티켓이 없으면 생성
            if not ticket:
                # TicketGrade enum 변환
                try:
                    grade_enum = TicketGrade(seat_info.grade)
                except ValueError:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid grade: {seat_info.grade}"
                    )
                
                ticket = Ticket(
                    event_id=request.event_id,
                    schedule_id=request.schedule_id,
                    seat_section=seat_info.seat_section,
                    seat_row=seat_info.row,
                    seat_number=seat_info.number,
                    grade=grade_enum,
                    price=seat_info.price
                )
                db.add(ticket)
                db.flush()  # ID를 얻기 위해 flush
            
            # 이미 예약된 티켓인지 확인 (schedule_id 필터링)
            booking_query = db.query(Booking).filter(
                Booking.ticket_id == ticket.id,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
            )
            if request.schedule_id:
                booking_query = booking_query.filter(
                    (Booking.schedule_id == request.schedule_id) | (Booking.schedule_id.is_(None))
                )
            existing_booking = booking_query.first()
            
            if existing_booking:
                # LOCK 해제
                for locked_id in locked_tickets:
                    redis_service.unlock_seat(locked_id)
                raise HTTPException(
                    status_code=400,
                    detail=f"Seat {seat_info.row}-{seat_info.number} is already booked"
                )
            
            # Booking 생성
            booking = Booking(
                user_id=current_user.id,
                ticket_id=ticket.id,
                schedule_id=request.schedule_id,
                status=BookingStatus.PENDING,
                total_price=seat_info.price,
                payment_method=None,
                transaction_id=None
            )
            db.add(booking)
            created_bookings.append(booking)
        
        # 3단계: 트랜잭션 커밋
        db.commit()
        
        # 4단계: 성공 후 캐시 무효화 및 LOCK 해제
        redis_service.invalidate_seat_cache(request.event_id, request.schedule_id)
        for locked_id in locked_tickets:
            redis_service.unlock_seat(locked_id)
        
        # 생성된 booking들을 응답 형식으로 변환
        result = []
        for booking in created_bookings:
            db.refresh(booking)
            result.append(BookingResponse(
                id=booking.id,
                user_id=booking.user_id,
                ticket_id=booking.ticket_id,
                status=booking.status.value,
                total_price=booking.total_price,
                booked_at=booking.booked_at.isoformat() if booking.booked_at else ""
            ))
        
        return result
        
    except HTTPException:
        # HTTPException은 그대로 전파
        # HTTPException은 비즈니스 로직 예외이므로 rollback은 FastAPI의 의존성 주입 시스템이 자동으로 처리
        # 여기서는 LOCK만 해제하고 예외를 전파
        # LOCK 해제
        for locked_id in locked_tickets:
            redis_service.unlock_seat(locked_id)
        raise
    except Exception as e:
        # 일반 예외는 DB 오류일 수 있으므로 rollback 시도
        try:
            db.rollback()
        except Exception:
            # rollback이 이미 진행되었거나 필요 없는 경우 무시
            pass
        # LOCK 해제
        for locked_id in locked_tickets:
            redis_service.unlock_seat(locked_id)
        raise HTTPException(status_code=500, detail=f"Booking failed: {str(e)}")


class UserBookingResponse(BaseModel):
    id: int
    booking_id: int
    event_id: int
    event_title: str
    event_poster_image: Optional[str]
    venue_name: Optional[str]
    schedule_date: Optional[str]
    schedule_time: Optional[str]
    seat_row: Optional[str]
    seat_number: Optional[int]
    grade: str
    price: float
    status: str
    booked_at: str
    reservation_number: str
    quantity: int

    class Config:
        from_attributes = True


@router.get("/bookings/my", response_model=List[UserBookingResponse])
def get_my_bookings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """현재 사용자의 예매 내역 조회"""
    # 사용자의 모든 예매 조회
    bookings = db.query(Booking).filter(
        Booking.user_id == current_user.id
    ).options(
        joinedload(Booking.ticket).joinedload(Ticket.event).joinedload(Event.schedules),
        joinedload(Booking.ticket).joinedload(Ticket.event).joinedload(Event.venue)
    ).order_by(Booking.booked_at.desc()).all()
    
    # 같은 시간(초 단위까지)에 예매한 booking들을 그룹화
    from datetime import datetime
    booking_groups = {}
    
    for booking in bookings:
        if not booking.ticket or not booking.ticket.event:
            continue
        
        # booked_at을 초 단위로 반올림하여 그룹화 키 생성
        if booking.booked_at:
            # 초 단위로 반올림 (같은 초에 예매한 것들을 같은 그룹으로)
            booked_at_rounded = booking.booked_at.replace(microsecond=0)
            group_key = f"{booking.user_id}_{booking.ticket.event_id}_{booked_at_rounded.isoformat()}"
        else:
            # booked_at이 없으면 booking_id를 키로 사용
            group_key = f"{booking.user_id}_{booking.id}"
        
        if group_key not in booking_groups:
            booking_groups[group_key] = []
        booking_groups[group_key].append(booking)
    
    result = []
    # 각 그룹에 대해 예약번호 생성 (그룹의 첫 번째 booking ID 사용)
    for group_key, group_bookings in booking_groups.items():
        # 그룹의 첫 번째 booking ID를 기준으로 예약번호 생성
        first_booking = group_bookings[0]
        reservation_number = f"M{first_booking.id:09d}"
        
        for booking in group_bookings:
            if not booking.ticket or not booking.ticket.event:
                continue
                
            event = booking.ticket.event
            ticket = booking.ticket
            
            # 스케줄 정보 가져오기 (첫 번째 스케줄 사용)
            schedule = None
            if event.schedules and len(event.schedules) > 0:
                schedule = event.schedules[0]
            
            schedule_date = None
            schedule_time = None
            if schedule:
                schedule_date = schedule.start_datetime.strftime("%Y.%m.%d") if schedule.start_datetime else None
                schedule_time = schedule.start_datetime.strftime("%H:%M") if schedule.start_datetime else None
            
            # venue 이름 가져오기
            venue_name = event.location
            if event.venue and event.venue.name:
                venue_name = event.venue.name
            
            result.append(UserBookingResponse(
                id=ticket.id if ticket.id else 0,
                booking_id=booking.id,
                event_id=event.id,
                event_title=event.title,
                event_poster_image=event.poster_image,
                venue_name=venue_name,
                schedule_date=schedule_date,
                schedule_time=schedule_time,
                seat_row=ticket.seat_row,
                seat_number=ticket.seat_number,
                grade=ticket.grade.value if ticket.grade else "A",
                price=booking.total_price,
                status=booking.status.value,
                booked_at=booking.booked_at.isoformat() if booking.booked_at else "",
                reservation_number=reservation_number,
                quantity=1
            ))
    
    return result

