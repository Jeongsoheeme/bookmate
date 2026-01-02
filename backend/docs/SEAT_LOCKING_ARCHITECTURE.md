# 좌석 예매 동시성 처리 아키텍처

## 개요

고트래픽 환경에서 여러 사용자가 동시에 같은 좌석을 예매하려고 할 때 발생하는 **Race Condition**을 방지하기 위한 다층 방어 전략입니다.

## 문제 상황

### Race Condition 시나리오

```
시간 | 사용자 A                    | 사용자 B                    | 데이터베이스
-----|----------------------------|----------------------------|---------------
T1   | 좌석 1번 조회 → 예약 가능   |                            | 좌석 1번: available
T2   |                            | 좌석 1번 조회 → 예약 가능  | 좌석 1번: available
T3   | 예약 진행...               |                            | 
T4   |                            | 예약 진행...               |
T5   | 예약 완료                  | 예약 완료                  | ❌ 중복 예약!
```

## 해결 전략: 다층 방어 (Defense in Depth)

### 1단계: Redis 분산 LOCK (빠른 차단)

**목적**: DB 부하를 줄이고 빠르게 중복 요청 차단

**특징**:
- **분산 환경 지원**: 여러 서버 인스턴스 간 동시성 제어
- **빠른 응답**: 메모리 기반으로 밀리초 단위 응답
- **자동 만료**: 타임아웃으로 데드락 방지

**구현**:
```python
# Redis SET NX EX 명령어 사용
# NX: 키가 없을 때만 설정 (Not eXists)
# EX: 만료 시간 설정 (Expire)
redis.set(f"seat_lock:{ticket_id}", lock_value, nx=True, ex=30)
```

**장점**:
- ✅ DB 부하 감소 (대부분의 중복 요청을 Redis에서 차단)
- ✅ 빠른 실패 응답 (사용자에게 즉시 피드백)
- ✅ 분산 환경에서도 동작

**단점**:
- ⚠️ Redis 장애 시 전체 시스템 영향 (Fallback 필요)

### 2단계: DB 레벨 LOCK (최종 보장)

**목적**: Redis를 우회한 요청이나 Redis 장애 시 최종 보장

**특징**:
- **SELECT FOR UPDATE**: 트랜잭션 내에서 행 레벨 LOCK
- **원자성 보장**: 트랜잭션 커밋/롤백으로 일관성 유지
- **데이터 정합성**: DB가 최종 진실의 소스 (Source of Truth)

**구현**:
```python
# SQLAlchemy with_for_update() 사용
ticket = db.query(Ticket).filter(
    Ticket.id == ticket_id
).with_for_update().first()
```

**장점**:
- ✅ 데이터 정합성 보장
- ✅ Redis 장애 시에도 동작
- ✅ 트랜잭션으로 원자성 보장

**단점**:
- ⚠️ DB 부하 증가 (트랜잭션 유지 시간)
- ⚠️ 동시 처리량 제한

### 3단계: 트랜잭션 (원자성 보장)

**목적**: 여러 좌석 예매 시 전체 성공 또는 전체 실패 보장

**특징**:
- **ACID 보장**: Atomicity, Consistency, Isolation, Durability
- **롤백 지원**: 오류 시 모든 변경사항 취소

## 아키텍처 흐름

```
사용자 요청
    ↓
[1단계] Redis LOCK 시도
    ├─ 성공 → 다음 단계
    └─ 실패 → 409 Conflict 응답 (즉시 반환)
    ↓
[2단계] DB 트랜잭션 시작
    ↓
[3단계] SELECT FOR UPDATE로 좌석 LOCK
    ↓
[4단계] 예약 가능 여부 확인
    ├─ 가능 → Booking 생성
    └─ 불가능 → 롤백 + Redis LOCK 해제
    ↓
[5단계] 트랜잭션 커밋
    ↓
[6단계] 캐시 무효화 + Redis LOCK 해제
    ↓
성공 응답
```

## 성능 최적화

### 1. 좌석 상태 캐싱

**목적**: 좌석 조회 API 성능 향상

```python
# 좌석 목록 조회 시 캐시 활용
cached_seats = redis_service.get_cached_event_seats(event_id, schedule_id)
if cached_seats:
    return cached_seats

# 캐시 미스 시 DB 조회 후 캐싱
seats = db.query(Ticket).filter(...).all()
redis_service.cache_event_seats(event_id, schedule_id, seats_data)
```

**효과**:
- DB 조회 횟수 감소
- 응답 시간 단축 (밀리초 → 마이크로초)

### 2. 배치 LOCK 해제

**목적**: 여러 좌석 예매 시 효율적인 LOCK 관리

```python
# 모든 좌석에 LOCK 획득 후 일괄 처리
locked_tickets = []
for seat in seats:
    if redis_service.try_lock_seat(seat_id):
        locked_tickets.append(seat_id)
    else:
        # 실패 시 이미 획득한 LOCK 모두 해제
        for locked_id in locked_tickets:
            redis_service.unlock_seat(locked_id)
        raise HTTPException(...)
```

## 확장성 고려사항

### 1. Redis 클러스터링

**고가용성**: Redis Sentinel 또는 Redis Cluster 사용

```python
# Redis Cluster 설정 예시
from redis.cluster import RedisCluster

cluster = RedisCluster(
    startup_nodes=[
        {"host": "redis1", "port": 6379},
        {"host": "redis2", "port": 6379},
        {"host": "redis3", "port": 6379},
    ]
)
```

### 2. DB 읽기/쓰기 분리

**읽기 전용 복제본**: 좌석 조회는 Read Replica 사용

```python
# 설정 분리
READ_DB_URL = "postgresql://replica:5432/db"
WRITE_DB_URL = "postgresql://master:5432/db"
```

### 3. 대기열 시스템 (선택사항)

**초고트래픽**: RabbitMQ, Kafka 등으로 요청 순서화

```
사용자 요청 → 대기열 → 순차 처리 → 응답
```

## 모니터링 및 알림

### 주요 메트릭

1. **Redis LOCK 획득 실패율**: 경쟁 정도 측정
2. **DB LOCK 대기 시간**: 병목 지점 파악
3. **예매 성공률**: 시스템 안정성 확인
4. **응답 시간**: 사용자 경험 모니터링

### 알림 설정

- Redis LOCK 실패율 > 10%: 경쟁 심화 알림
- DB 트랜잭션 타임아웃: 장애 알림
- 예매 성공률 < 95%: 시스템 문제 알림

## 장애 대응

### Redis 장애 시

1. **Fallback**: Redis 없이도 DB LOCK만으로 동작 (성능 저하)
2. **Circuit Breaker**: Redis 장애 감지 시 자동 우회
3. **재시도 로직**: 일시적 장애 대응

### DB 장애 시

1. **읽기 전용 모드**: 조회만 허용, 예매 중단
2. **장애 복구**: 자동 재연결 및 복구

## 설정 가이드

### 환경 변수

```env
# Redis 설정
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=your_password

# 좌석 LOCK 타임아웃 (초)
SEAT_LOCK_TIMEOUT=30
```

### 권장 설정값

- **SEAT_LOCK_TIMEOUT**: 30초 (예매 프로세스 완료 시간 고려)
- **캐시 TTL**: 60초 (좌석 상태 변경 빈도 고려)
- **DB 트랜잭션 타임아웃**: 10초

## 테스트 시나리오

### 동시성 테스트

```python
# 100명이 동시에 같은 좌석 예매 시도
import asyncio
import httpx

async def test_concurrent_booking():
    async with httpx.AsyncClient() as client:
        tasks = [
            client.post("/api/v1/bookings", json=booking_data)
            for _ in range(100)
        ]
        results = await asyncio.gather(*tasks)
        
        # 성공은 1개만 있어야 함
        success_count = sum(1 for r in results if r.status_code == 200)
        assert success_count == 1
```

## 결론

고트래픽 환경에서는 **다층 방어 전략**이 필수입니다:

1. ✅ **Redis 분산 LOCK**: 빠른 차단, DB 부하 감소
2. ✅ **DB 레벨 LOCK**: 최종 보장, 데이터 정합성
3. ✅ **트랜잭션**: 원자성 보장, 일관성 유지

이 조합으로 **확장 가능하고 안정적인** 좌석 예매 시스템을 구축할 수 있습니다.

