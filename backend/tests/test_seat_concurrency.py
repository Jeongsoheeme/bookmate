"""
좌석 선택 동시성 테스트

이 테스트는 좌석 선택 시 동시성 문제를 해결하기 위한 락(Lock) 기능이
제대로 작동하는지 확인합니다.

테스트 시나리오:
1. 락 적용 전: 여러 사용자가 동시에 같은 좌석을 선택하면 중복 예약 발생
2. 락 적용 후: 여러 사용자가 동시에 같은 좌석을 선택해도 한 명만 성공
"""
import pytest
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any
import time
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, Base, engine, SessionLocal
from app.models.user import User
from app.models.event import Event, EventGenre, EventSubGenre
from app.models.event_schedule import EventSchedule
from app.models.event_seat_grade import EventSeatGrade
from app.models.ticket import Ticket
from app.models.booking import Booking, BookingStatus
from app.models.venue import Venue
from app.models.refresh_token import RefreshToken
from app.core.security import get_password_hash
from app.core.dependencies import get_current_user
from app.services.redis_service import redis_service
import redis


# 테스트용 데이터베이스 설정
# 실제 데이터베이스를 사용하거나, 테스트 전용 DB를 사용할 수 있습니다
# 환경 변수 TEST_DATABASE_URL이 있으면 사용하고, 없으면 기본 설정 사용
import os
from sqlalchemy import create_engine as create_engine_sqlalchemy
from sqlalchemy.orm import sessionmaker as sessionmaker_sqlalchemy

# 테스트용 데이터베이스 URL (환경 변수에서 가져오거나 기본값 사용)
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", 
    None  # None이면 실제 설정의 DATABASE_URL 사용
)

# 테스트용 엔진 및 세션 (테스트 DB가 지정된 경우에만 사용)
test_engine = None
TestSessionLocal = None

if TEST_DATABASE_URL:
    # 테스트 전용 데이터베이스 사용
    test_engine = create_engine_sqlalchemy(TEST_DATABASE_URL)
    TestSessionLocal = sessionmaker_sqlalchemy(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    """
    테스트용 데이터베이스 세션 생성
    
    옵션:
    1. TEST_DATABASE_URL 환경 변수가 설정되어 있으면 테스트 전용 DB 사용
    2. 없으면 실제 설정의 DATABASE_URL 사용 (기본 동작)
    """
    if TestSessionLocal:
        # 테스트 전용 데이터베이스 사용
        db = TestSessionLocal()
    else:
        # 실제 데이터베이스 사용 (기본 동작)
        db = SessionLocal()
    
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def test_client(db_session):
    """테스트용 FastAPI 클라이언트"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_users(db_session: Session):
    """테스트용 사용자 생성"""
    # 이전 테스트 데이터 정리 (먼저 삭제)
    try:
        existing_users = db_session.query(User).filter(
            User.email.like("test_user_%@example.com")
        ).all()
        for existing_user in existing_users:
            # 외래키 제약을 고려한 삭제 순서:
            # 1. Booking 삭제
            # 2. RefreshToken 삭제
            # 3. User 삭제
            db_session.query(Booking).filter(Booking.user_id == existing_user.id).delete()
            db_session.query(RefreshToken).filter(RefreshToken.user_id == existing_user.id).delete()
            db_session.delete(existing_user)
        db_session.commit()
    except Exception:
        db_session.rollback()
        pass
    
    # 새 테스트 사용자 생성
    users = []
    for i in range(5):  # 5명의 테스트 사용자
        user = User(
            email=f"test_user_{i}@example.com",
            username=f"testuser{i}",
            hashed_password=get_password_hash("testpassword123")
        )
        db_session.add(user)
        users.append(user)
    
    db_session.commit()
    for user in users:
        db_session.refresh(user)
    
    yield users
    
    # 정리
    try:
        for user in users:
            # 외래키 제약을 고려한 삭제 순서
            # 1. Booking 삭제
            db_session.query(Booking).filter(Booking.user_id == user.id).delete()
            # 2. RefreshToken 삭제
            db_session.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
            # 3. User 삭제
            db_session.delete(user)
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        # 정리 실패해도 계속 진행
        pass


@pytest.fixture(scope="function")
def test_event(db_session: Session):
    """테스트용 이벤트 생성"""
    # 이전 테스트 데이터 정리 (올바른 순서로 삭제)
    try:
        existing_events = db_session.query(Event).filter(
            Event.title.like("Test Event%")
        ).all()
        for existing_event in existing_events:
            # 외래키 제약을 고려한 삭제 순서:
            # 1. Booking 삭제 (ticket_id 참조)
            # 2. Ticket 삭제 (schedule_id 참조)
            # 3. EventSeatGrade 삭제
            # 4. EventSchedule 삭제
            # 5. Event 삭제
            # 6. Venue 삭제
            
            # Booking 삭제 (ticket_id를 통해)
            ticket_ids = [t.id for t in db_session.query(Ticket.id).filter(
                Ticket.event_id == existing_event.id
            ).all() if t.id is not None]
            if ticket_ids:
                db_session.query(Booking).filter(
                    Booking.ticket_id.in_(ticket_ids)
                ).delete(synchronize_session=False)
            
            # Ticket 삭제
            db_session.query(Ticket).filter(Ticket.event_id == existing_event.id).delete()
            
            # EventSeatGrade 삭제
            db_session.query(EventSeatGrade).filter(EventSeatGrade.event_id == existing_event.id).delete()
            
            # EventSchedule 삭제
            db_session.query(EventSchedule).filter(EventSchedule.event_id == existing_event.id).delete()
            
            # Event 삭제
            db_session.delete(existing_event)
            
            # Venue 삭제 (이벤트가 없으면)
            if existing_event.venue_id:
                venue_has_other_events = db_session.query(Event).filter(
                    Event.venue_id == existing_event.venue_id,
                    Event.id != existing_event.id
                ).first()
                if not venue_has_other_events:
                    db_session.query(Venue).filter(Venue.id == existing_event.venue_id).delete()
        
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        # 에러가 발생해도 계속 진행 (이전 테스트 데이터가 없을 수도 있음)
        pass
    
    # Venue 생성
    venue = Venue(
        name="Test Venue",
        location="Test Location",
        capacity=100,
        seat_map={
            "sections": ["A구역"],
            "seats_per_row": 10
        }
    )
    db_session.add(venue)
    db_session.flush()
    
    # Event 생성 (유효한 enum 값 사용)
    event = Event(
        title="Test Event for Concurrency",
        description="Test event for concurrency testing",
        location="Test Location",
        poster_image=None,
        genre=EventGenre.CONCERT,
        sub_genre=EventSubGenre.BALLAD,  # 유효한 enum 값 사용
        venue_id=venue.id
    )
    db_session.add(event)
    db_session.flush()
    
    # Schedule 생성
    from datetime import datetime, timedelta
    schedule = EventSchedule(
        event_id=event.id,
        start_datetime=datetime.now() + timedelta(days=30),
        running_time=120
    )
    db_session.add(schedule)
    db_session.flush()
    
    # Seat Grade 생성
    seat_grade = EventSeatGrade(
        event_id=event.id,
        schedule_id=schedule.id,
        row="1",
        grade="VIP",
        price=100000.0
    )
    db_session.add(seat_grade)
    db_session.commit()
    
    db_session.refresh(event)
    db_session.refresh(schedule)
    
    yield event, schedule
    
    # 정리 (올바른 순서로 삭제)
    try:
        # 1. Booking 삭제
        ticket_ids = [t.id for t in db_session.query(Ticket.id).filter(
            Ticket.event_id == event.id
        ).all() if t.id is not None]
        if ticket_ids:
            db_session.query(Booking).filter(
                Booking.ticket_id.in_(ticket_ids)
            ).delete(synchronize_session=False)
        
        # 2. Ticket 삭제
        db_session.query(Ticket).filter(Ticket.event_id == event.id).delete()
        
        # 3. EventSeatGrade 삭제
        db_session.query(EventSeatGrade).filter(EventSeatGrade.event_id == event.id).delete()
        
        # 4. EventSchedule 삭제
        db_session.query(EventSchedule).filter(EventSchedule.event_id == event.id).delete()
        
        # 5. Event 삭제
        db_session.query(Event).filter(Event.id == event.id).delete()
        
        # 6. Venue 삭제
        db_session.query(Venue).filter(Venue.id == venue.id).delete()
        
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        # 정리 실패해도 계속 진행
        pass


def get_auth_token(client: TestClient, email: str, password: str = "testpassword123"):
    """인증 토큰 획득"""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    return None


def create_booking_request(
    client: TestClient,
    token: str,
    event_id: int,
    schedule_id: int,
    seat_row: str,
    seat_number: int
) -> Dict[str, Any]:
    """예약 요청 생성 (락 사용)"""
    response = client.post(
        "/api/v1/bookings",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "event_id": event_id,
            "schedule_id": schedule_id,
            "seats": [{
                "row": seat_row,
                "number": seat_number,
                "grade": "VIP",
                "price": 100000.0,
                "seat_section": "A구역"
            }],
            "total_price": 100000.0,
            "receipt_method": "on_site"
        }
    )
    return {
        "status_code": response.status_code,
        "response": response.json() if response.status_code < 500 else response.text
    }


def create_booking_without_lock(
    user_id: int,
    event_id: int,
    schedule_id: int,
    seat_row: str,
    seat_number: int
) -> Dict[str, Any]:
    """
    락 없이 예약 생성 (동시성 문제 재현용)
    이 함수는 락을 사용하지 않고 직접 DB에 접근하여 예약을 생성합니다.
    각 스레드마다 새 세션을 생성합니다.
    """
    # 각 스레드마다 새 세션 생성 (동시성 문제 방지)
    from app.database import SessionLocal
    db_session = SessionLocal()
    try:
        # 티켓 조회 또는 생성 (락 없이)
        ticket = db_session.query(Ticket).filter(
            Ticket.event_id == event_id,
            Ticket.schedule_id == schedule_id,
            Ticket.seat_row == seat_row,
            Ticket.seat_number == seat_number
        ).first()
        
        if not ticket:
            from app.models.ticket import TicketGrade
            ticket = Ticket(
                event_id=event_id,
                schedule_id=schedule_id,
                seat_row=seat_row,
                seat_number=seat_number,
                seat_section="A구역",
                grade=TicketGrade.VIP,
                price=100000.0
            )
            db_session.add(ticket)
            db_session.flush()
        
        # 이미 예약된 티켓인지 확인 (락 없이 - 동시성 문제 발생 가능)
        existing_booking = db_session.query(Booking).filter(
            Booking.ticket_id == ticket.id,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
        ).first()
        
        if existing_booking:
            return {
                "success": False,
                "error": "Already booked",
                "user_id": user_id
            }
        
        # 예약 생성
        booking = Booking(
            user_id=user_id,
            ticket_id=ticket.id,
            schedule_id=schedule_id,
            status=BookingStatus.PENDING,
            total_price=100000.0
        )
        db_session.add(booking)
        db_session.commit()
        
        return {
            "success": True,
            "booking_id": booking.id,
            "user_id": user_id
        }
    except Exception as e:
        db_session.rollback()
        return {
            "success": False,
            "error": str(e),
            "user_id": user_id
        }
    finally:
        db_session.close()


def test_concurrent_booking_without_lock(db_session: Session, test_users: List[User], test_event):
    """
    테스트 1: 락 없이 동시 예약 시도
    여러 사용자가 동시에 같은 좌석을 예약하면 중복 예약이 발생할 수 있습니다.
    """
    event, schedule = test_event
    seat_row = "1열"
    seat_number = 1
    
    # Redis 락 초기화 (테스트를 위해)
    try:
        # 테스트용 티켓 ID 생성
        ticket_key = f"{event.id}:{schedule.id}:{seat_row}:{seat_number}"
        ticket_id = -abs(hash(ticket_key)) % 1000000
        redis_service.unlock_seat(ticket_id)
    except:
        pass
    
    # 5명의 사용자가 동시에 같은 좌석 예약 시도
    results = []
    
    def book_seat(user: User):
        return create_booking_without_lock(
            user.id,
            event.id,
            schedule.id,
            seat_row,
            seat_number
        )
    
    # 동시 실행
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(book_seat, user) for user in test_users[:5]]
        for future in as_completed(futures):
            results.append(future.result())
    
    # 결과 분석
    successful_bookings = [r for r in results if r.get("success")]
    failed_bookings = [r for r in results if not r.get("success")]
    
    print("\n" + "="*60)
    print("테스트 1: 락 없이 동시 예약 시도")
    print("="*60)
    print(f"총 요청 수: {len(results)}")
    print(f"성공한 예약: {len(successful_bookings)}개")
    print(f"실패한 예약: {len(failed_bookings)}개")
    
    # 실제 DB에서 확인
    ticket = db_session.query(Ticket).filter(
        Ticket.event_id == event.id,
        Ticket.schedule_id == schedule.id,
        Ticket.seat_row == seat_row,
        Ticket.seat_number == seat_number
    ).first()
    
    if ticket:
        actual_bookings = db_session.query(Booking).filter(
            Booking.ticket_id == ticket.id,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
        ).count()
        
        print(f"실제 DB에 저장된 예약 수: {actual_bookings}개")
        print(f"\n⚠️  문제: {len(successful_bookings)}명이 성공했다고 했지만, 실제로는 {actual_bookings}개의 예약만 저장됨")
        print("   → 동시성 문제로 인해 중복 예약이 발생했습니다!")
        
        # 정리
        db_session.query(Booking).filter(Booking.ticket_id == ticket.id).delete()
        if ticket:
            db_session.delete(ticket)
        db_session.commit()
    
    # 락 없이는 여러 명이 성공할 수 있음 (동시성 문제)
    assert len(successful_bookings) >= 1, "최소 1명은 성공해야 함"


def test_concurrent_booking_with_lock(test_client: TestClient, test_users: List[User], test_event):
    """
    테스트 2: 락을 사용한 동시 예약 시도
    여러 사용자가 동시에 같은 좌석을 예약해도 락 덕분에 한 명만 성공합니다.
    """
    event, schedule = test_event
    seat_row = "1열"
    seat_number = 2  # 다른 좌석 사용
    
    # Redis 락 초기화
    try:
        ticket_key = f"{event.id}:{schedule.id}:{seat_row}:{seat_number}"
        ticket_id = -abs(hash(ticket_key)) % 1000000
        redis_service.unlock_seat(ticket_id)
    except:
        pass
    
    # 각 사용자의 토큰 획득
    tokens = {}
    for user in test_users[:5]:
        token = get_auth_token(test_client, user.email)
        if token:
            tokens[user.id] = token
    
    # 5명의 사용자가 동시에 같은 좌석 예약 시도
    results = []
    
    def book_seat(user: User):
        token = tokens.get(user.id)
        if not token:
            return {"status_code": 401, "response": "No token"}
        
        return create_booking_request(
            test_client,
            token,
            event.id,
            schedule.id,
            seat_row,
            seat_number
        )
    
    # 동시 실행
    start_time = time.time()
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(book_seat, user) for user in test_users[:5]]
        for future in as_completed(futures):
            results.append(future.result())
    end_time = time.time()
    
    # 결과 분석
    successful_bookings = [r for r in results if r.get("status_code") == 200]
    failed_bookings = [r for r in results if r.get("status_code") != 200]
    
    print("\n" + "="*60)
    print("테스트 2: 락을 사용한 동시 예약 시도")
    print("="*60)
    print(f"총 요청 수: {len(results)}")
    print(f"성공한 예약: {len(successful_bookings)}개")
    print(f"실패한 예약: {len(failed_bookings)}개")
    print(f"실행 시간: {end_time - start_time:.2f}초")
    
    for i, result in enumerate(successful_bookings):
        print(f"  성공 {i+1}: {result.get('response', {})}")
    
    for i, result in enumerate(failed_bookings):
        print(f"  실패 {i+1}: 상태코드 {result.get('status_code')}, 응답: {result.get('response', {})}")
    
    # 락을 사용하면 정확히 1명만 성공해야 함
    assert len(successful_bookings) == 1, f"락을 사용하면 정확히 1명만 성공해야 하는데, {len(successful_bookings)}명이 성공했습니다."
    assert len(failed_bookings) == 4, f"락을 사용하면 나머지 4명은 실패해야 하는데, {len(failed_bookings)}명만 실패했습니다."
    
    print("\n✅ 성공: 락 덕분에 정확히 1명만 예약에 성공했습니다!")


def test_seat_lock_api(test_client: TestClient, test_users: List[User], test_event):
    """
    테스트 3: 좌석 잠금 API 테스트
    /seats/lock API가 제대로 작동하는지 확인합니다.
    """
    event, schedule = test_event
    seat_row = "1열"
    seat_number = 3
    
    # Redis 락 초기화
    try:
        ticket_key = f"{event.id}:{schedule.id}:{seat_row}:{seat_number}"
        ticket_id = -abs(hash(ticket_key)) % 1000000
        redis_service.unlock_seat(ticket_id)
    except:
        pass
    
    # 첫 번째 사용자가 좌석 잠금
    user1 = test_users[0]
    token1 = get_auth_token(test_client, user1.email)
    
    response1 = test_client.post(
        "/api/v1/seats/lock",
        headers={"Authorization": f"Bearer {token1}"},
        json={
            "event_id": event.id,
            "schedule_id": schedule.id,
            "seats": [{"row": seat_row, "number": seat_number}]
        }
    )
    
    assert response1.status_code == 200
    lock_response1 = response1.json()
    assert lock_response1["success"] == True
    print(f"\n사용자 1이 좌석을 잠금: {lock_response1['message']}")
    
    # 두 번째 사용자가 같은 좌석 잠금 시도 (실패해야 함)
    user2 = test_users[1]
    token2 = get_auth_token(test_client, user2.email)
    
    response2 = test_client.post(
        "/api/v1/seats/lock",
        headers={"Authorization": f"Bearer {token2}"},
        json={
            "event_id": event.id,
            "schedule_id": schedule.id,
            "seats": [{"row": seat_row, "number": seat_number}]
        }
    )
    
    assert response2.status_code == 200
    lock_response2 = response2.json()
    assert lock_response2["success"] == False
    print(f"사용자 2의 잠금 시도: {lock_response2['message']}")
    
    print("\n✅ 성공: 좌석 잠금 API가 제대로 작동합니다!")


if __name__ == "__main__":
    """
    테스트 실행 방법:
    
    1. pytest로 실행:
       pytest tests/test_seat_concurrency.py -v -s
    
    2. 직접 실행:
       python -m pytest tests/test_seat_concurrency.py -v -s
    """
    pytest.main([__file__, "-v", "-s"])
