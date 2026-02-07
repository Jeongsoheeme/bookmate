# 대기열 시스템 구현 가이드

## 개요

인기 이벤트 오픈 시 동시 접속자 폭증으로 인한 서버 부하를 방지하고, 공정한 예매 기회를 제공하기 위한 대기열 시스템 구현 가이드입니다.

## 대기열 적용 지점

### ⚠️ 중요: 메인 페이지에서 인기 이벤트 클릭 시 대기열 진입

**문제점**: 
1. 좌석 선택 API에만 대기열을 적용하면 → 이벤트 상세 페이지에 트래픽 몰림
2. 이벤트 상세 페이지부터 대기열 적용하면 → 메인 페이지에 트래픽 몰림

**해결책**: 
- **메인 페이지는 대기열 없음** (빠른 로딩)
- **인기 이벤트 클릭 시 → 대기열 진입 페이지로 이동**
- **대기열 통과 후 → 이벤트 상세 페이지로 이동**
- 대기열 통과 후 발급된 토큰으로 좌석 선택 및 예매까지 진행

### ✅ 권장: 단계별 대기열 적용

#### 0단계: 메인 페이지 (Rate Limiting 적용, 대기열 없음)
- **메인 페이지는 대기열 적용하지 않음** (사용자 경험 우선)
- **하지만 Rate Limiting은 적용 필요** (서버 보호)
- 빠른 로딩으로 사용자 경험 유지
- 인기 이벤트 클릭 시 → 대기열 진입 페이지로 이동

**⚠️ 중요**: 메인 페이지도 부하가 발생할 수 있습니다!
- 인기 이벤트 오픈 시 메인 페이지 API (`GET /api/v1/events/`)에도 많은 요청 발생
- **대기열은 공정한 예매를 위한 것**이므로 메인 페이지에는 부적합
- **Rate Limiting**으로 동시 접속 제한 (예: IP당 초당 10회)
- 또는 **캐싱** 활용 (이벤트 목록은 자주 변경되지 않으므로)

#### 1단계: 대기열 진입 페이지 (새로 추가)
- **`GET /api/v1/queue/enter/{event_id}`** - 대기열 진입 API
- 인기 이벤트 클릭 시 이 페이지로 이동
- 대기열 통과 후 **대기열 토큰 발급** (일정 시간 유효)
- 대기 순서 표시 및 진행 상황 안내

#### 2단계: 이벤트 상세 페이지 조회 API
- **`GET /api/v1/events/{event_id}`** - 이벤트 상세 정보 조회
- 대기열 토큰 검증 필수
- 토큰이 없거나 만료된 경우 대기열 진입 페이지로 리다이렉트

#### 3단계: 티켓 조회 API
- **`GET /api/v1/events/{event_id}/tickets`** - 티켓 목록 조회
- 대기열 토큰 검증 필수
- 토큰이 없거나 만료된 경우 대기열 재진입 필요

#### 4단계: 좌석 잠금 및 예매 API
- **`POST /api/v1/seats/lock`** - 좌석 잠금
- **`POST /api/v1/bookings`** - 예매 생성
- 대기열 토큰 검증 필수

### ✅ 프론트엔드 페이지별 적용

1. **메인 페이지** (`MainPage`)
   - **대기열 없음** (사용자 경험 우선)
   - **Rate Limiting 적용** (서버 보호)
   - **캐싱 활용** (이벤트 목록 캐싱)
   - 인기 이벤트 클릭 시 → 대기열 진입 페이지로 이동
   - 일반 이벤트 클릭 시 → 바로 이벤트 상세 페이지로 이동

2. **대기열 진입 페이지** (`QueuePage`) - 새로 추가
   - 인기 이벤트 클릭 시 이 페이지로 이동
   - 대기 순서 표시 및 진행 상황 안내
   - 대기열 통과 후 → 이벤트 상세 페이지로 자동 이동

3. **이벤트 상세 페이지** (`EventDetailPage`)
   - 대기열 토큰 검증
   - 토큰이 없거나 만료된 경우 → 대기열 진입 페이지로 리다이렉트
   - 토큰이 유효하면 이벤트 정보 표시

4. **좌석 선택 페이지** (`SeatSelectionPage`)
   - 대기열 토큰 검증
   - 토큰이 없으면 대기열 진입 페이지로 리다이렉트

5. **예매 결제 페이지**
   - 대기열 토큰 검증
   - 토큰이 없거나 만료된 경우 대기열 재진입

### ❌ 비권장: 사이트 전체 대기열 적용

- 메인 페이지, 이벤트 목록 조회, 검색 등은 **대기열 불필요**
- 사용자 경험 저하 및 불필요한 대기 시간 발생
- **인기 이벤트 클릭 시에만 대기열 진입 페이지로 이동**

### ✅ 메인 페이지 보호 방법: Rate Limiting vs 대기열

| 구분 | 대기열 | Rate Limiting |
|------|--------|---------------|
| **목적** | 공정한 예매 기회 제공 | 서버 부하 방지 |
| **적용 대상** | 인기 이벤트 예매 | 모든 API |
| **사용자 경험** | 대기 시간 발생 | 즉시 응답 (초과 시 에러) |
| **공정성** | 선착순 보장 | 없음 |
| **구현 복잡도** | 높음 | 낮음 |

**메인 페이지에는 Rate Limiting이 더 적합**:
- 조회만 하는 페이지이므로 공정성보다는 서버 보호가 우선
- 대기열은 예매 시 공정한 기회를 제공하기 위한 것
- Rate Limiting으로 동시 접속 제한 (예: IP당 초당 10회)

## 구현 방법

### 핵심 개념: 대기열 토큰 시스템

1. **이벤트 상세 페이지 접근 시** → 대기열 진입
2. **대기열 통과 후** → 대기열 토큰 발급 (예: 10분 유효)
3. **좌석 선택/예매 시** → 대기열 토큰 검증
4. **토큰 만료 시** → 대기열 재진입 필요

이렇게 하면 사용자들이 메인 페이지나 이벤트 상세 페이지에 몰리는 것을 방지할 수 있습니다.

### 1. 백엔드: Redis 기반 대기열 미들웨어

Redis를 활용한 대기열 시스템 구현:

```python
# backend/app/middleware/queue_middleware.py
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.services.redis_service import redis_service
import time
import uuid

class QueueMiddleware(BaseHTTPMiddleware):
    """특정 엔드포인트에 대기열을 적용하는 미들웨어"""
    
    # 대기열이 필요한 엔드포인트 목록
    # 이벤트 상세 조회부터 대기열 적용 (최우선)
    QUEUE_ENDPOINTS = [
        "/api/v1/events/{event_id}",  # 이벤트 상세 조회 (인기 이벤트만)
        "/api/v1/events/{event_id}/tickets",  # 티켓 조회
        "/api/v1/seats/lock",  # 좌석 잠금
        "/api/v1/bookings",  # 예매 생성
    ]
    
    # 대기열 토큰이 필요한 엔드포인트 (대기열 통과 후 접근 가능)
    TOKEN_REQUIRED_ENDPOINTS = [
        "/api/v1/events/{event_id}/tickets",
        "/api/v1/seats/lock",
        "/api/v1/bookings",
    ]
    
    # 이벤트별 대기열 활성화 여부 (동적 설정 가능)
    # 예: {event_id: True} 형태로 관리
    QUEUE_ENABLED_EVENTS = {}
    
    async def dispatch(self, request: Request, call_next):
        # 이벤트 ID 추출
        event_id = await self._extract_event_id(request)
        
        # 이벤트 상세 조회 API인 경우
        if self._is_event_detail_endpoint(request.url.path, event_id):
            if event_id and self._is_queue_enabled(event_id):
                # 대기열 토큰 확인
                queue_token = request.headers.get("X-Queue-Token")
                
                if not queue_token or not await self._validate_queue_token(event_id, queue_token):
                    # 대기열 진입 필요
                    return await self._handle_queue_entry(request, event_id, call_next)
                
                # 토큰이 유효하면 통과
                return await call_next(request)
        
        # 다른 엔드포인트의 경우 대기열 토큰 검증
        if self._is_token_required_endpoint(request.url.path):
            if event_id:
                queue_token = request.headers.get("X-Queue-Token")
                if not queue_token or not await self._validate_queue_token(event_id, queue_token):
                    return JSONResponse(
                        status_code=403,
                        content={
                            "error": "대기열 토큰 필요",
                            "message": "이벤트 상세 페이지에서 대기열을 통과해주세요."
                        }
                    )
        
        return await call_next(request)
    
    async def _handle_queue_entry(self, request: Request, event_id: int, call_next):
        """대기열 진입 처리"""
        user_id = self._get_user_id(request)
        if not user_id:
            return await call_next(request)
        
        # 대기열 진입
        queue_key = f"queue:event:{event_id}"
        position = await self._enter_queue(queue_key, user_id)
        
        if position is None:
            return JSONResponse(
                status_code=503,
                content={
                    "error": "대기열 진입 실패",
                    "message": "잠시 후 다시 시도해주세요."
                }
            )
        
        # 대기열 순서 대기
        if position > 0:
            await self._wait_in_queue(queue_key, user_id, position)
        
        # 대기 완료 후 대기열 토큰 발급
        queue_token = await self._issue_queue_token(event_id, user_id)
        
        # 실제 요청 처리
        try:
            response = await call_next(request)
            # 응답 헤더에 대기열 토큰 추가
            response.headers["X-Queue-Token"] = queue_token
            response.headers["X-Queue-Token-Expires"] = str(int(time.time()) + 600)  # 10분
            return response
        finally:
            # 대기열에서 제거 (토큰은 유지)
            await self._exit_queue(queue_key, user_id)
    
    async def _enter_queue(self, queue_key: str, user_id: int) -> int | None:
        """대기열에 진입하고 현재 순서 반환"""
        try:
            # Redis Sorted Set을 사용하여 대기열 관리
            # Score는 진입 시간 (타임스탬프)
            timestamp = time.time()
            redis_service.client.zadd(queue_key, {str(user_id): timestamp})
            
            # 현재 순서 확인 (0부터 시작)
            position = redis_service.client.zrank(queue_key, str(user_id))
            return position if position is not None else None
        except Exception:
            return None
    
    async def _wait_in_queue(self, queue_key: str, user_id: int, position: int):
        """대기열에서 순서를 기다림"""
        max_wait_time = 300  # 최대 5분 대기
        check_interval = 1  # 1초마다 확인
        waited_time = 0
        
        while waited_time < max_wait_time:
            current_position = redis_service.client.zrank(queue_key, str(user_id))
            
            # 순서가 되었거나 (position == 0) 대기열에서 제거된 경우
            if current_position is None or current_position == 0:
                break
            
            await asyncio.sleep(check_interval)
            waited_time += check_interval
        
        if waited_time >= max_wait_time:
            raise HTTPException(
                status_code=408,
                detail="대기 시간이 초과되었습니다. 다시 시도해주세요."
            )
    
    async def _exit_queue(self, queue_key: str, user_id: int):
        """대기열에서 제거"""
        try:
            redis_service.client.zrem(queue_key, str(user_id))
        except Exception:
            pass
    
    async def _extract_event_id(self, request: Request) -> int | None:
        """요청에서 이벤트 ID 추출"""
        # POST 요청의 경우 본문에서 추출
        if request.method == "POST":
            body = await request.body()
            # JSON 파싱 필요 (간단한 예시)
            # 실제로는 request.json() 사용 권장
            pass
        
        # 경로 파라미터에서 추출
        # 예: /api/v1/events/{event_id}/tickets
        path_parts = request.url.path.split("/")
        if "events" in path_parts:
            event_idx = path_parts.index("events")
            if event_idx + 1 < len(path_parts):
                try:
                    return int(path_parts[event_idx + 1])
                except ValueError:
                    pass
        
        return None
    
    def _is_queue_enabled(self, event_id: int | None) -> bool:
        """이벤트에 대기열이 활성화되어 있는지 확인"""
        if event_id is None:
            return False
        return self.QUEUE_ENABLED_EVENTS.get(event_id, False)
    
    def _get_user_id(self, request: Request) -> int | None:
        """요청에서 사용자 ID 추출 (인증 토큰에서)"""
        # 실제 구현에서는 JWT 토큰에서 사용자 ID 추출
        # 여기서는 예시로만 작성
        return None
    
    def _is_event_detail_endpoint(self, path: str, event_id: int | None) -> bool:
        """이벤트 상세 조회 엔드포인트인지 확인"""
        if not event_id:
            return False
        # /api/v1/events/{event_id} 패턴 확인
        pattern = f"/api/v1/events/{event_id}"
        return path == pattern or path.startswith(pattern + "/")
    
    def _is_token_required_endpoint(self, path: str) -> bool:
        """대기열 토큰이 필요한 엔드포인트인지 확인"""
        for endpoint in self.TOKEN_REQUIRED_ENDPOINTS:
            # {event_id} 부분을 와일드카드로 처리
            if "{event_id}" in endpoint:
                pattern = endpoint.replace("{event_id}", r"\d+")
                import re
                if re.match(pattern, path):
                    return True
            elif path == endpoint:
                return True
        return False
    
    async def _issue_queue_token(self, event_id: int, user_id: int) -> str:
        """대기열 토큰 발급"""
        import secrets
        token = secrets.token_urlsafe(32)
        token_key = f"queue_token:event:{event_id}:user:{user_id}"
        # 토큰을 Redis에 저장 (10분 유효)
        redis_service.client.setex(token_key, 600, token)
        return token
    
    async def _validate_queue_token(self, event_id: int, token: str) -> bool:
        """대기열 토큰 검증"""
        # 사용자 ID 추출 필요 (토큰에서 또는 별도 저장소에서)
        # 간단한 예시: 토큰이 Redis에 존재하는지 확인
        # 실제로는 user_id와 함께 검증해야 함
        token_pattern = f"queue_token:event:{event_id}:*"
        keys = redis_service.client.keys(token_pattern)
        for key in keys:
            stored_token = redis_service.client.get(key)
            if stored_token == token:
                return True
        return False
```

### 2. 백엔드: 대기열 진입 및 상태 조회 API

```python
# backend/app/api/v1/endpoints/queue.py
from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.event import Event
from app.services.redis_service import redis_service
from app.database import get_db
from sqlalchemy.orm import Session
import time
import secrets

router = APIRouter()

@router.post("/queue/enter/{event_id}")
async def enter_queue(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """대기열 진입"""
    # 이벤트 확인
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # 인기 이벤트인지 확인 (is_hot 또는 queue_enabled 필드 확인)
    if not event.is_hot and not getattr(event, 'queue_enabled', False):
        # 인기 이벤트가 아니면 바로 토큰 발급 (대기열 없음)
        token = await _issue_queue_token(event_id, current_user.id)
        return {
            "in_queue": False,
            "queue_token": token,
            "position": 0,
            "total": 0
        }
    
    queue_key = f"queue:event:{event_id}"
    
    try:
        # 이미 대기열에 있는지 확인
        position = redis_service.client.zrank(queue_key, str(current_user.id))
        
        if position is not None:
            # 이미 대기열에 있음
            total = redis_service.client.zcard(queue_key)
            return {
                "in_queue": True,
                "queue_token": None,
                "position": position + 1,
                "total": total,
                "estimated_wait_time": position * 2
            }
        
        # 대기열 진입
        timestamp = time.time()
        redis_service.client.zadd(queue_key, {str(current_user.id): timestamp})
        
        # 현재 순서 확인
        position = redis_service.client.zrank(queue_key, str(current_user.id))
        total = redis_service.client.zcard(queue_key)
        
        return {
            "in_queue": True,
            "queue_token": None,
            "position": position + 1 if position is not None else total,
            "total": total,
            "estimated_wait_time": (position or 0) * 2
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/queue/status/{event_id}")
async def get_queue_status(
    event_id: int,
    current_user: User = Depends(get_current_user)
):
    """대기열 상태 조회"""
    queue_key = f"queue:event:{event_id}"
    
    try:
        # 현재 사용자의 대기 순서
        position = redis_service.client.zrank(queue_key, str(current_user.id))
        
        # 전체 대기 인원
        total = redis_service.client.zcard(queue_key)
        
        if position is None:
            return {
                "in_queue": False,
                "position": None,
                "total": total
            }
        
        # 순서가 되었는지 확인 (position == 0)
        if position == 0:
            # 대기열 통과 → 토큰 발급
            token = await _issue_queue_token(event_id, current_user.id)
            # 대기열에서 제거
            redis_service.client.zrem(queue_key, str(current_user.id))
            return {
                "in_queue": False,
                "queue_token": token,
                "position": 0,
                "total": total
            }
        
        # 예상 대기 시간 계산
        estimated_wait_time = await _calculate_estimated_wait_time(
            event_id, position or 0
        )
        
        return {
            "in_queue": True,
            "queue_token": None,
            "position": position + 1,  # 1부터 시작하는 순서
            "total": total,
            "estimated_wait_time": estimated_wait_time  # 예상 대기 시간 (초)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _issue_queue_token(event_id: int, user_id: int) -> str:
    """대기열 토큰 발급"""
    token = secrets.token_urlsafe(32)
    token_key = f"queue_token:event:{event_id}:user:{user_id}"
    # 토큰을 Redis에 저장 (10분 유효)
    redis_service.client.setex(token_key, 600, token)
    return token

async def _calculate_estimated_wait_time(event_id: int, position: int) -> int:
    """
    예상 대기 시간 계산
    
    여러 방법을 조합하여 정확한 예상 시간 계산:
    1. 최근 처리 속도 기반 (동적 계산)
    2. 평균 처리 시간 기반 (기본값)
    3. 히스토리 기반 (과거 데이터 활용)
    """
    queue_key = f"queue:event:{event_id}"
    
    # 방법 1: 최근 처리 속도 기반 (가장 정확)
    recent_processing_rate = await _get_recent_processing_rate(event_id)
    if recent_processing_rate > 0:
        # 최근 처리 속도가 있으면 이를 사용
        estimated = int(position / recent_processing_rate)
        return max(estimated, 0)  # 최소 0초
    
    # 방법 2: 평균 처리 시간 기반 (기본값)
    # 평균적으로 1명당 2초 소요 (실제 데이터로 조정 필요)
    avg_processing_time = 2  # 초
    estimated = position * avg_processing_time
    
    return estimated

async def _get_recent_processing_rate(event_id: int) -> float:
    """
    최근 처리 속도 계산 (명/초)
    
    Redis에 최근 처리 이력을 저장하고, 이를 기반으로 계산
    """
    try:
        # 최근 처리 이력 키
        history_key = f"queue_history:event:{event_id}"
        
        # 최근 1분간의 처리 이력 조회
        # Redis Sorted Set에 처리 시간을 저장 (score: timestamp, value: processed_count)
        current_time = time.time()
        one_minute_ago = current_time - 60
        
        # 최근 1분간 처리된 인원 수 조회
        processed_count = redis_service.client.zcount(
            history_key, one_minute_ago, current_time
        )
        
        if processed_count > 0:
            # 최근 1분간 처리 속도 (명/초)
            return processed_count / 60.0
        
        return 0.0
    except Exception:
        return 0.0

async def _record_queue_processing(event_id: int):
    """
    대기열 처리 완료 기록 (통계용)
    
    대기열 통과 시 호출하여 처리 이력을 저장
    """
    try:
        history_key = f"queue_history:event:{event_id}"
        current_time = time.time()
        
        # 처리 이력 저장 (Sorted Set)
        redis_service.client.zadd(history_key, {str(current_time): current_time})
        
        # 오래된 데이터 삭제 (1시간 이상 된 데이터)
        one_hour_ago = current_time - 3600
        redis_service.client.zremrangebyscore(history_key, 0, one_hour_ago)
        
        # TTL 설정 (1일)
        redis_service.client.expire(history_key, 86400)
    except Exception:
        pass
```

### 예상 대기 시간 계산 방법 상세 설명

대기열에서 예상 대기 시간을 계산하는 방법은 여러 가지가 있습니다:

#### 1. 단순 계산 (기본 방법)

```python
estimated_wait_time = position * avg_processing_time
```

**예시:**
- 현재 순서: 100번
- 평균 처리 시간: 2초/명
- 예상 대기 시간: 100 × 2 = 200초 (약 3분 20초)

**장점:**
- 구현이 간단
- 계산이 빠름

**단점:**
- 실제 처리 속도와 차이 발생 가능
- 트래픽이 많을 때와 적을 때 차이 반영 안 됨

#### 2. 동적 계산 (최근 처리 속도 기반) - 권장

```python
# 최근 1분간 처리된 인원 수 기반
recent_processing_rate = processed_count / 60.0  # 명/초
estimated_wait_time = position / recent_processing_rate
```

**예시:**
- 현재 순서: 100번
- 최근 1분간 처리: 30명
- 처리 속도: 30명/60초 = 0.5명/초
- 예상 대기 시간: 100 / 0.5 = 200초 (약 3분 20초)

**장점:**
- 실제 처리 속도 반영
- 트래픽 변화에 따라 자동 조정

**단점:**
- 구현이 복잡
- 초기에는 데이터가 없어서 부정확할 수 있음

#### 3. 가중 평균 (최근 데이터에 더 높은 가중치)

```python
# 최근 1분: 가중치 0.5
# 최근 5분: 가중치 0.3
# 최근 15분: 가중치 0.2
weighted_rate = (
    recent_1min_rate * 0.5 +
    recent_5min_rate * 0.3 +
    recent_15min_rate * 0.2
)
estimated_wait_time = position / weighted_rate
```

**장점:**
- 최근 데이터와 과거 데이터를 모두 활용
- 더 정확한 예측

**단점:**
- 구현이 매우 복잡
- 계산 비용이 높음

#### 4. 실제 구현 예시 (동적 계산 + 폴백)

```python
async def _calculate_estimated_wait_time(event_id: int, position: int) -> int:
    """예상 대기 시간 계산 (동적 계산 + 폴백)"""
    
    # 1순위: 최근 처리 속도 기반
    recent_rate = await _get_recent_processing_rate(event_id)
    if recent_rate > 0:
        estimated = int(position / recent_rate)
        return max(estimated, 0)
    
    # 2순위: 평균 처리 시간 기반 (폴백)
    avg_processing_time = 2  # 초
    return position * avg_processing_time
```

### 처리 이력 저장 방법

대기열 통과 시 처리 이력을 저장하여 통계를 수집합니다:

```python
# 대기열 통과 시 호출
@router.post("/queue/enter/{event_id}")
async def enter_queue(...):
    # ... 대기열 진입 로직 ...
    
    # 순서가 되었을 때 (position == 0)
    if position == 0:
        # 처리 이력 기록
        await _record_queue_processing(event_id)
        # 토큰 발급
        token = await _issue_queue_token(event_id, current_user.id)
        # ...
```

### 예상 대기 시간 표시 개선

프론트엔드에서 더 나은 UX를 위해:

```typescript
// 예상 대기 시간 표시
{estimatedWaitTime > 0 && (
  <div>
    <p className="text-gray-600">예상 대기 시간</p>
    <p className="text-xl font-semibold text-gray-900">
      {estimatedWaitTime < 60
        ? `약 ${estimatedWaitTime}초`
        : estimatedWaitTime < 3600
        ? `약 ${Math.ceil(estimatedWaitTime / 60)}분`
        : `약 ${Math.ceil(estimatedWaitTime / 3600)}시간 ${Math.ceil((estimatedWaitTime % 3600) / 60)}분`}
    </p>
    <p className="text-xs text-gray-500 mt-1">
      * 실제 대기 시간은 상황에 따라 달라질 수 있습니다
    </p>
  </div>
)}
```

### 주의사항

1. **초기 대기 시간**: 처리 이력이 없을 때는 평균값 사용
2. **변동성**: 실제 대기 시간은 변동이 있을 수 있음을 사용자에게 알림
3. **업데이트 주기**: 2-5초마다 예상 시간 업데이트
4. **최대 시간 제한**: 예상 시간이 너무 길면 (예: 1시간 이상) 사용자에게 알림

### 3. 프론트엔드: API 클라이언트에 대기열 토큰 추가

```typescript
// frontend/src/services/api.ts 수정
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    // 대기열 토큰 추가 (이벤트 관련 요청에만)
    const queueToken = localStorage.getItem(`queueToken:${eventId}`);
    if (queueToken && config.url?.includes("/events/")) {
      config.headers["X-Queue-Token"] = queueToken;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    // 대기열 토큰이 응답 헤더에 있으면 저장
    const queueToken = response.headers["x-queue-token"];
    const tokenExpires = response.headers["x-queue-token-expires"];
    
    if (queueToken) {
      // 이벤트 ID 추출 (URL에서)
      const eventIdMatch = response.config.url?.match(/\/events\/(\d+)/);
      if (eventIdMatch) {
        const eventId = eventIdMatch[1];
        localStorage.setItem(`queueToken:${eventId}`, queueToken);
        if (tokenExpires) {
          localStorage.setItem(`queueTokenExpires:${eventId}`, tokenExpires);
        }
      }
    }
    
    return response;
  },
  async (error) => {
    // 403 에러이고 대기열 토큰 관련이면 이벤트 상세 페이지로 리다이렉트
    if (error.response?.status === 403 && 
        error.response?.data?.error === "대기열 토큰 필요") {
      const eventIdMatch = error.config.url?.match(/\/events\/(\d+)/);
      if (eventIdMatch) {
        const eventId = eventIdMatch[1];
        window.location.href = `/event/${eventId}`;
      }
    }
    
    // 기존 토큰 갱신 로직...
    return Promise.reject(error);
  }
);
```

### 4. 프론트엔드: 대기열 UI 컴포넌트

```typescript
// frontend/src/components/QueueModal.tsx
import React, { useState, useEffect } from "react";

interface QueueModalProps {
  eventId: number;
  isOpen: boolean;
  onQueueComplete: (queueToken: string) => void;
}

const QueueModal: React.FC<QueueModalProps> = ({
  eventId,
  isOpen,
  onQueueComplete,
}) => {
  const [position, setPosition] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    const checkQueueStatus = async () => {
      try {
        // 이벤트 상세 조회 API 호출 (대기열 진입)
        const response = await fetch(
          `${API_BASE_URL}/api/v1/events/${eventId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            },
          }
        );

        // 대기열 토큰이 응답 헤더에 있으면 대기 완료
        const queueToken = response.headers.get("X-Queue-Token");
        if (queueToken) {
          localStorage.setItem(`queueToken:${eventId}`, queueToken);
          onQueueComplete(queueToken);
          return;
        }

        // 대기열 상태 확인 API 호출
        const statusResponse = await fetch(
          `${API_BASE_URL}/api/v1/queue/status/${eventId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            },
          }
        );
        const data = await statusResponse.json();

        if (data.in_queue) {
          setPosition(data.position);
          setTotal(data.total);
          setEstimatedWaitTime(data.estimated_wait_time);
        } else {
          // 대기열에 없으면 완료 처리
          onQueueComplete("");
        }
      } catch (error) {
        console.error("대기열 상태 확인 실패:", error);
      }
    };

    // 초기 확인
    checkQueueStatus();

    // 폴링: 2-5초마다 상태 확인
    // 웹소켓 대신 폴링을 사용하는 이유는 아래 "폴링 vs 웹소켓" 섹션 참고
    const interval = setInterval(checkQueueStatus, 2000);

    return () => clearInterval(interval);
  }, [isOpen, eventId, onQueueComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          대기 중입니다
        </h2>
        <div className="space-y-4">
          <div>
            <p className="text-gray-600">현재 대기 순서</p>
            <p className="text-3xl font-bold text-blue-600">
              {position !== null ? `${position}번` : "확인 중..."}
            </p>
          </div>
          <div>
            <p className="text-gray-600">전체 대기 인원</p>
            <p className="text-xl font-semibold text-gray-900">{total}명</p>
          </div>
          {estimatedWaitTime > 0 && (
            <div>
              <p className="text-gray-600">예상 대기 시간</p>
              <p className="text-xl font-semibold text-gray-900">
                약 {Math.ceil(estimatedWaitTime / 60)}분
              </p>
            </div>
          )}
          <div className="mt-6">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    position && total > 0
                      ? ((total - position + 1) / total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 text-center mt-4">
            잠시만 기다려주세요. 순서가 되면 자동으로 진행됩니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QueueModal;
```

### 5. 프론트엔드: 메인 페이지에서 인기 이벤트 클릭 시 대기열 진입

```typescript
// frontend/src/components/BannerCarousel.tsx 수정
onClick={() => {
  if (item.eventId) {
    // 인기 이벤트인지 확인 (is_hot 필드 또는 별도 API 호출)
    // 인기 이벤트면 대기열 진입 페이지로 이동
    navigate(`/queue/${item.eventId}`);
  } else if (item.link) {
    // 기존 링크 처리...
  }
}}

// frontend/src/components/ConcertBrowse.tsx 수정
onClick={() => {
  // 인기 이벤트인지 확인
  const isHot = concert.is_hot === 1; // 또는 별도 필드 확인
  if (isHot) {
    navigate(`/queue/${concert.id}`);
  } else {
    navigate(`/event/${concert.id}`);
  }
}}
```

### 6. 프론트엔드: 대기열 진입 페이지 (새로 추가)

```typescript
// frontend/src/pages/QueuePage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { queueApi } from "../services/api";

const QueuePage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [position, setPosition] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(0);

  useEffect(() => {
    if (!eventId) return;

    // 대기열 진입
    const enterQueue = async () => {
      try {
        const response = await queueApi.enter(Number(eventId));
        
        if (!response.in_queue) {
          // 대기열이 없거나 이미 통과한 경우
          if (response.queue_token) {
            localStorage.setItem(`queueToken:${eventId}`, response.queue_token);
          }
          navigate(`/event/${eventId}`);
          return;
        }
        
        setPosition(response.position);
        setTotal(response.total);
        setEstimatedWaitTime(response.estimated_wait_time || 0);
      } catch (error) {
        console.error("대기열 진입 실패:", error);
      }
    };

    enterQueue();

    // 2초마다 상태 확인
    const interval = setInterval(async () => {
      try {
        const status = await queueApi.getStatus(Number(eventId));
        
        if (!status.in_queue && status.queue_token) {
          // 대기열 통과
          localStorage.setItem(`queueToken:${eventId}`, status.queue_token);
          clearInterval(interval);
          navigate(`/event/${eventId}`);
        } else if (status.in_queue) {
          setPosition(status.position);
          setTotal(status.total);
          setEstimatedWaitTime(status.estimated_wait_time || 0);
        }
      } catch (error) {
        console.error("대기열 상태 확인 실패:", error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [eventId, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
            대기 중입니다
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-gray-600 text-center">현재 대기 순서</p>
              <p className="text-4xl font-bold text-blue-600 text-center mt-2">
                {position !== null ? `${position}번` : "확인 중..."}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-center">전체 대기 인원</p>
              <p className="text-xl font-semibold text-gray-900 text-center mt-1">
                {total}명
              </p>
            </div>
            {estimatedWaitTime > 0 && (
              <div>
                <p className="text-gray-600 text-center">예상 대기 시간</p>
                <p className="text-xl font-semibold text-gray-900 text-center mt-1">
                  약 {Math.ceil(estimatedWaitTime / 60)}분
                </p>
              </div>
            )}
            <div className="mt-6">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      position && total > 0
                        ? ((total - position + 1) / total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <p className="text-sm text-gray-500 text-center mt-4">
              잠시만 기다려주세요. 순서가 되면 자동으로 진행됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueuePage;
```

### 7. 프론트엔드: 이벤트 상세 페이지에 토큰 검증 추가

```typescript
// frontend/src/pages/EventDetailPage.tsx 수정
useEffect(() => {
  const fetchEvent = async () => {
    if (!eventId) return;
    
    // 대기열 토큰 확인
    const storedToken = localStorage.getItem(`queueToken:${eventId}`);
    
    if (!storedToken) {
      // 토큰이 없으면 대기열 진입 페이지로 리다이렉트
      navigate(`/queue/${eventId}`);
      return;
    }
    
    try {
      const eventData = await eventsApi.getById(Number(eventId));
      setEvent(eventData);
    } catch (error: any) {
      // 403 에러면 토큰이 만료된 것
      if (error.response?.status === 403) {
        localStorage.removeItem(`queueToken:${eventId}`);
        navigate(`/queue/${eventId}`);
      }
    } finally {
      setLoading(false);
    }
  };

  fetchEvent();
}, [eventId, navigate]);
```

## 설정 방법

### 1. 이벤트별 대기열 활성화

관리자 페이지에서 인기 이벤트에 대기열을 활성화:

```python
# 이벤트 모델에 대기열 활성화 필드 추가
class Event(Base):
    # ... 기존 필드들 ...
    queue_enabled: bool = False  # 대기열 활성화 여부
    max_queue_size: int = 1000   # 최대 대기 인원
```

### 2. 환경 변수 설정

```env
# .env
QUEUE_ENABLED=true
QUEUE_MAX_SIZE=1000
QUEUE_CHECK_INTERVAL=2  # 대기열 상태 확인 간격 (초)
```

## 모니터링

대기열 상태를 모니터링하기 위한 관리자 API:

```python
@router.get("/admin/queue/stats")
async def get_queue_stats():
    """전체 대기열 통계"""
    # Redis에서 모든 대기열 키 조회
    # 각 이벤트별 대기 인원, 평균 대기 시간 등 통계 제공
    pass
```

## 주의사항

1. **이벤트 상세 페이지부터 대기열 적용**: 좌석 선택 API에만 적용하면 이벤트 상세 페이지에 트래픽이 몰림
2. **대기열 토큰 관리**: 토큰 만료 시간을 적절히 설정 (너무 짧으면 사용자 불편, 너무 길면 보안 문제)
3. **대기열 타임아웃**: 사용자가 대기 중에 페이지를 떠나면 대기열에서 제거
4. **동시 접속 제한**: 한 사용자가 여러 세션에서 대기열에 진입하는 것 방지
5. **서버 부하**: 대기열 상태 확인 요청이 너무 많으면 서버 부하 발생 가능 (폴링 간격 조절)
6. **공정성**: 선착순 대기열로 공정한 예매 기회 제공
7. **메인 페이지 보호**: 메인 페이지는 대기열 대신 **Rate Limiting + 캐싱**으로 보호
8. **대기열 vs Rate Limiting**: 대기열은 공정한 예매를 위한 것, Rate Limiting은 서버 보호를 위한 것

## Rate Limiting과 캐싱 이해하기

### Rate Limiting이란?

**Rate Limiting**은 **일정 시간 동안 요청 횟수를 제한**하는 것입니다.

#### 예시로 이해하기

```
사용자 A가 메인 페이지를 열 때:
- 1초에 10번까지만 요청 허용
- 11번째 요청부터는 "요청이 너무 많습니다" 에러 반환
```

**왜 필요한가?**
- 악의적인 사용자가 서버를 공격하는 것을 방지
- 서버가 과부하되는 것을 방지
- 모든 사용자가 공평하게 서비스를 이용할 수 있도록 보장

**대기열과의 차이:**
- **대기열**: 순서대로 기다렸다가 처리 (공정한 예매 기회 제공)
- **Rate Limiting**: 초과 요청은 바로 거부 (서버 보호)

#### 실제 동작 예시

```
사용자 A (IP: 192.168.1.1)
- 00:00:00 - 요청 1 ✅
- 00:00:00 - 요청 2 ✅
- ...
- 00:00:00 - 요청 10 ✅
- 00:00:00 - 요청 11 ❌ "요청이 너무 많습니다"
- 00:00:01 - 요청 12 ✅ (1초가 지나서 다시 허용)
```

### 캐싱이란?

**캐싱**은 **자주 조회하는 데이터를 메모리에 저장**해두고, 다음 요청 시 빠르게 반환하는 것입니다.

#### 예시로 이해하기

**캐싱 없을 때:**
```
사용자 A: 메인 페이지 요청
  → DB에서 이벤트 목록 조회 (1초 소요)
  → 결과 반환

사용자 B: 메인 페이지 요청
  → DB에서 이벤트 목록 조회 (1초 소요)  ← 또 조회!
  → 결과 반환

사용자 C: 메인 페이지 요청
  → DB에서 이벤트 목록 조회 (1초 소요)  ← 또 조회!
  → 결과 반환
```
**문제점**: 같은 데이터를 계속 DB에서 조회 → 서버 부하 증가

**캐싱 있을 때:**
```
사용자 A: 메인 페이지 요청
  → DB에서 이벤트 목록 조회 (1초 소요)
  → Redis에 캐시 저장 (5분 유효)
  → 결과 반환

사용자 B: 메인 페이지 요청
  → Redis에서 캐시 조회 (0.01초 소요)  ← 빠름!
  → 결과 반환

사용자 C: 메인 페이지 요청
  → Redis에서 캐시 조회 (0.01초 소요)  ← 빠름!
  → 결과 반환

5분 후, 사용자 D: 메인 페이지 요청
  → 캐시 만료됨
  → DB에서 이벤트 목록 조회 (1초 소요)
  → Redis에 새로 캐시 저장
  → 결과 반환
```

**장점:**
- **속도 향상**: DB 조회보다 100배 빠름
- **서버 부하 감소**: DB 조회 횟수 대폭 감소
- **비용 절감**: 서버 리소스 절약

### 메인 페이지에서 캐싱을 하는 이유

**메인 페이지의 특징:**
1. **많은 사용자가 동시에 접속**
   - 인기 이벤트 오픈 시 수천 명이 동시에 메인 페이지 접속
   - 모두 같은 이벤트 목록을 조회

2. **데이터가 자주 변경되지 않음**
   - 이벤트 목록은 몇 분에 한 번씩만 변경
   - 5분 캐싱해도 문제없음

3. **조회만 하는 페이지**
   - 데이터를 읽기만 함 (수정/삭제 없음)
   - 캐시해도 안전함

**캐싱 효과:**
```
캐싱 없을 때:
- 1000명이 동시 접속
- DB 조회 1000번
- 서버 부하: 매우 높음 ❌

캐싱 있을 때:
- 1000명이 동시 접속
- DB 조회 1번 (첫 요청만)
- 나머지 999명은 캐시에서 조회
- 서버 부하: 매우 낮음 ✅
```

## 메인 페이지 보호: Rate Limiting 구현

메인 페이지는 대기열 대신 **Rate Limiting**으로 보호합니다.

### 백엔드: Rate Limiting 미들웨어

```python
# backend/app/middleware/rate_limit_middleware.py
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.services.redis_service import redis_service
import time

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate Limiting 미들웨어 (메인 페이지 보호용)"""
    
    # Rate Limiting이 필요한 엔드포인트
    RATE_LIMIT_ENDPOINTS = [
        "/api/v1/events/",  # 메인 페이지 이벤트 목록 조회
        "/api/v1/banners/",  # 배너 조회
    ]
    
    # Rate Limit 설정 (IP당)
    MAX_REQUESTS = 10  # 최대 요청 수
    TIME_WINDOW = 1  # 시간 윈도우 (초)
    
    async def dispatch(self, request: Request, call_next):
        # Rate Limiting이 필요한 엔드포인트인지 확인
        if not any(request.url.path.startswith(endpoint) for endpoint in self.RATE_LIMIT_ENDPOINTS):
            return await call_next(request)
        
        # 클라이언트 IP 추출
        client_ip = request.client.host if request.client else "unknown"
        
        # Rate Limit 확인
        if not await self._check_rate_limit(client_ip):
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "message": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
                },
                headers={
                    "Retry-After": str(self.TIME_WINDOW)
                }
            )
        
        return await call_next(request)
    
    async def _check_rate_limit(self, client_ip: str) -> bool:
        """Rate Limit 확인"""
        try:
            key = f"rate_limit:{client_ip}"
            current = redis_service.client.incr(key)
            
            if current == 1:
                # 첫 요청이면 TTL 설정
                redis_service.client.expire(key, self.TIME_WINDOW)
            
            return current <= self.MAX_REQUESTS
        except Exception:
            # Redis 오류 시 허용 (서비스 중단 방지)
            return True
```

### main.py에 미들웨어 추가

```python
# backend/app/main.py
from app.middleware.rate_limit_middleware import RateLimitMiddleware

# Rate Limiting 미들웨어 추가 (대기열 미들웨어보다 먼저)
app.add_middleware(RateLimitMiddleware)

# 대기열 미들웨어 추가
app.add_middleware(QueueMiddleware)
```

### 캐싱 활용 (추가 보호)

```python
# backend/app/api/v1/endpoints/events.py
from app.services.redis_service import redis_service
import json

@router.get("/", response_model=List[EventResponse])
def get_all_events(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """모든 사용자가 접근 가능한 이벤트 목록 조회 (캐싱 적용)"""
    cache_key = f"events:all:{skip}:{limit}"
    
    # 캐시 확인
    cached = redis_service.client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # DB 조회
    events = db.query(Event).offset(skip).limit(limit).all()
    result = [EventResponse.from_orm(e) for e in events]
    
    # 캐시 저장 (5분)
    redis_service.client.setex(
        cache_key,
        300,
        json.dumps([e.dict() for e in result])
    )
    
    return result
```

## 개념 비교 정리

### 대기열 vs Rate Limiting vs 캐싱

| 구분 | 대기열 | Rate Limiting | 캐싱 |
|------|--------|---------------|------|
| **목적** | 공정한 예매 기회 제공 | 서버 부하 방지 | 빠른 응답 속도 |
| **동작 방식** | 순서대로 대기 후 처리 | 초과 요청 즉시 거부 | 저장된 데이터 즉시 반환 |
| **사용자 경험** | 대기 시간 발생 | 즉시 응답 (초과 시 에러) | 즉시 응답 (빠름) |
| **적용 대상** | 인기 이벤트 예매 | 모든 API | 자주 조회하는 데이터 |
| **구현 복잡도** | 높음 | 중간 | 낮음 |
| **예시** | 콘서트 티켓 예매 | IP당 초당 10회 제한 | 이벤트 목록 5분 캐싱 |

### 실제 시나리오 비교

#### 시나리오: 인기 콘서트 오픈 시 10,000명이 동시 접속

**1. 대기열 적용 (인기 이벤트 예매)**
```
10,000명이 동시에 예매 시도
  → 대기열에 순서대로 진입
  → 1번부터 순서대로 처리
  → 공정한 예매 기회 제공 ✅
```

**2. Rate Limiting 적용 (메인 페이지)**
```
10,000명이 동시에 메인 페이지 접속
  → IP당 초당 10회 제한
  → 정상 사용자: 정상 접속 ✅
  → 악의적 사용자: 초과 요청 차단 ✅
  → 서버 보호 ✅
```

**3. 캐싱 적용 (메인 페이지)**
```
10,000명이 동시에 메인 페이지 접속
  → 첫 번째 사용자: DB 조회 (1초)
  → 나머지 9,999명: 캐시 조회 (0.01초) ✅
  → 서버 부하 대폭 감소 ✅
  → 응답 속도 100배 향상 ✅
```

## 요약: 페이지별 보호 방법

| 페이지/API | 보호 방법 | 이유 |
|-----------|----------|------|
| **메인 페이지** | Rate Limiting + 캐싱 | 조회만 하므로 공정성 불필요, 서버 보호만 필요 |
| **인기 이벤트 상세** | 대기열 | 공정한 예매 기회 제공 필요 |
| **좌석 선택/예매** | 대기열 토큰 검증 | 대기열 통과한 사용자만 접근 |
| **일반 이벤트** | Rate Limiting | 인기 이벤트가 아니므로 대기열 불필요 |

## 대기열 상태 조회: 폴링 vs 웹소켓

대기열 상태(예상 시간, 인원)를 클라이언트에서 받는 방법은 두 가지가 있습니다.

### 폴링 (Polling) - 권장 ✅

**폴링**은 클라이언트가 주기적으로 서버에 요청을 보내서 상태를 확인하는 방법입니다.

#### 구현 방법

```typescript
// 2-5초마다 상태 확인
const interval = setInterval(async () => {
  const status = await queueApi.getStatus(eventId);
  setPosition(status.position);
  setTotal(status.total);
  setEstimatedWaitTime(status.estimated_wait_time);
}, 2000); // 2초마다
```

#### 장점

1. **구현이 간단**
   - 기존 HTTP API 활용
   - 추가 인프라 불필요
   - 웹소켓 서버 구축 불필요

2. **서버 확장이 쉬움**
   - Stateless (상태 없음)
   - 로드 밸런서 활용 용이
   - 서버 추가/제거가 자유로움

3. **에러 처리 용이**
   - HTTP 에러 처리 그대로 사용
   - 재연결 로직 불필요
   - 네트워크 오류 시 자동 재시도

4. **캐싱 활용 가능**
   - 대기열 상태를 Redis에 캐싱
   - 같은 이벤트의 여러 사용자가 캐시 공유
   - 서버 부하 감소

5. **모바일 친화적**
   - 배터리 소모 적음
   - 백그라운드에서도 동작
   - 네트워크 전환 시 자동 재연결

#### 단점

1. **약간의 지연**
   - 최대 2-5초 지연 가능
   - 하지만 대기열에서는 충분히 허용 가능

2. **서버 요청 증가**
   - 사용자 수 × 요청 빈도만큼 요청 발생
   - 하지만 캐싱으로 완화 가능

#### 서버 부하 완화 방법

```python
# 대기열 상태 캐싱 (1초)
@router.get("/queue/status/{event_id}")
async def get_queue_status(...):
    cache_key = f"queue_status:event:{event_id}"
    
    # 캐시 확인
    cached = redis_service.client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # 실제 계산
    status = calculate_queue_status(...)
    
    # 캐시 저장 (1초)
    redis_service.client.setex(cache_key, 1, json.dumps(status))
    
    return status
```

**효과:**
- 1000명이 2초마다 요청 → 실제 계산은 1초에 1번만
- 나머지 999명은 캐시에서 조회
- 서버 부하 대폭 감소 ✅

### 웹소켓 (WebSocket)

**웹소켓**은 서버와 클라이언트 간 지속적인 연결을 유지하고, 서버에서 클라이언트로 실시간으로 데이터를 푸시하는 방법입니다.

#### 구현 방법

```typescript
// 웹소켓 연결
const ws = new WebSocket(`ws://api.example.com/queue/${eventId}`);

ws.onmessage = (event) => {
  const status = JSON.parse(event.data);
  setPosition(status.position);
  setTotal(status.total);
  setEstimatedWaitTime(status.estimated_wait_time);
};
```

#### 장점

1. **실시간 업데이트**
   - 즉시 상태 반영
   - 지연 없음

2. **서버 푸시 가능**
   - 서버에서 클라이언트로 직접 전송
   - 클라이언트 요청 불필요

3. **연결 유지로 오버헤드 감소**
   - HTTP 헤더 오버헤드 없음
   - 연결 설정 비용 1회만

#### 단점

1. **구현 복잡도 높음**
   - 웹소켓 서버 구축 필요
   - 연결 관리 로직 필요
   - 재연결 로직 필요

2. **서버 부하 증가**
   - 10,000명이 동시 연결 → 10,000개 연결 유지
   - 메모리 사용량 증가
   - 연결 관리 오버헤드

3. **확장 어려움**
   - Stateful (상태 있음)
   - 로드 밸런서 설정 복잡
   - 서버 간 연결 공유 필요 (Sticky Session)

4. **에러 처리 복잡**
   - 연결 끊김 처리
   - 재연결 로직
   - 네트워크 전환 시 처리

5. **모바일 배터리 소모**
   - 지속적인 연결 유지
   - 백그라운드에서도 연결 유지

### 비교표

| 구분 | 폴링 | 웹소켓 |
|------|------|--------|
| **구현 복잡도** | 낮음 ✅ | 높음 ❌ |
| **서버 부하** | 중간 (캐싱으로 완화) ✅ | 높음 (연결 유지) ❌ |
| **실시간성** | 2-5초 지연 | 즉시 ✅ |
| **확장성** | 쉬움 (Stateless) ✅ | 어려움 (Stateful) ❌ |
| **에러 처리** | 간단 ✅ | 복잡 ❌ |
| **모바일 친화** | 좋음 ✅ | 나쁨 ❌ |
| **인프라** | 기존 HTTP ✅ | 웹소켓 서버 필요 ❌ |

### 실제 시나리오 비교

#### 시나리오: 인기 콘서트 오픈 시 10,000명이 대기열 진입

**1. 폴링 방식**
```
10,000명이 2초마다 상태 확인
  → 캐싱 적용 시: 실제 계산 1초에 1번
  → 나머지 9,999명은 캐시에서 조회
  → 서버 부하: 낮음 ✅
  → 구현: 간단 ✅
```

**2. 웹소켓 방식**
```
10,000명이 동시에 웹소켓 연결
  → 10,000개 연결 유지
  → 메모리 사용량 증가
  → 서버 부하: 높음 ❌
  → 구현: 복잡 ❌
```

### 권장사항: 폴링 사용 ✅

**이유:**
1. **대기열은 완벽한 실시간이 불필요**
   - 2-5초 지연은 허용 가능
   - 사용자 경험에 큰 영향 없음

2. **구현이 간단**
   - 기존 HTTP API 활용
   - 추가 인프라 불필요

3. **서버 부하 완화 가능**
   - 캐싱으로 부하 감소
   - 확장이 쉬움

4. **에러 처리 용이**
   - HTTP 에러 처리 그대로 사용
   - 재연결 로직 불필요

### 동적 폴링 구현 방법

**동적 폴링**은 현재 대기 순서에 따라 폴링 간격을 자동으로 조정하는 방법입니다.

#### 개념

```
순서가 가까우면 (곧 차례) → 더 자주 확인 (1초)
순서가 멀면 → 덜 자주 확인 (5초)
```

**이유:**
- 순서가 가까우면 빠르게 반응해야 함
- 순서가 멀면 서버 부하를 줄이기 위해 덜 자주 확인

#### 방법 1: useEffect로 간격 재설정 (권장)

```typescript
// frontend/src/pages/QueuePage.tsx
import React, { useState, useEffect, useRef } from "react";

const QueuePage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [position, setPosition] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(0);
  
  // interval 참조 저장
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 폴링 간격 계산 함수
  const getPollingInterval = (currentPosition: number | null): number => {
    if (currentPosition === null) return 2000; // 초기: 2초
    if (currentPosition <= 10) return 1000;   // 곧 순서 (10명 이하): 1초
    if (currentPosition <= 50) return 2000;   // 가까움 (50명 이하): 2초
    if (currentPosition <= 200) return 3000;  // 중간 (200명 이하): 3초
    return 5000;                               // 멀리 (200명 이상): 5초
  };

  // 상태 확인 함수
  const checkStatus = async () => {
    try {
      const status = await queueApi.getStatus(Number(eventId));
      
      if (!status.in_queue && status.queue_token) {
        // 대기열 통과
        localStorage.setItem(`queueToken:${eventId}`, status.queue_token);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        navigate(`/event/${eventId}`);
        return;
      }
      
      if (status.in_queue) {
        // 상태 업데이트
        setPosition(status.position);
        setTotal(status.total);
        setEstimatedWaitTime(status.estimated_wait_time || 0);
      }
    } catch (error) {
      console.error("대기열 상태 확인 실패:", error);
    }
  };

  useEffect(() => {
    if (!eventId) return;

    // 초기 대기열 진입
    const enterQueue = async () => {
      try {
        const response = await queueApi.enter(Number(eventId));
        
        if (!response.in_queue && response.queue_token) {
          localStorage.setItem(`queueToken:${eventId}`, response.queue_token);
          navigate(`/event/${eventId}`);
          return;
        }
        
        if (response.in_queue) {
          setPosition(response.position);
          setTotal(response.total);
          setEstimatedWaitTime(response.estimated_wait_time || 0);
        }
      } catch (error) {
        console.error("대기열 진입 실패:", error);
      }
    };

    enterQueue();

    // 초기 상태 확인
    checkStatus();

    // 동적 폴링 시작
    const startPolling = () => {
      // 기존 interval 정리
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // 현재 순서에 맞는 간격으로 새 interval 설정
      const interval = getPollingInterval(position);
      intervalRef.current = setInterval(checkStatus, interval);
    };

    startPolling();

    // 정리 함수
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [eventId, navigate]);

  // position이 변경될 때마다 폴링 간격 재조정
  useEffect(() => {
    if (position === null) return;

    // 기존 interval 정리
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // 새로운 간격으로 재시작
    const newInterval = getPollingInterval(position);
    intervalRef.current = setInterval(checkStatus, newInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [position]); // position이 변경될 때마다 실행

  // ... UI 렌더링 ...
};
```

#### 방법 2: setTimeout으로 재귀 호출 (더 정확)

```typescript
// frontend/src/pages/QueuePage.tsx
const QueuePage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [position, setPosition] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(0);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 폴링 간격 계산
  const getPollingInterval = (currentPosition: number | null): number => {
    if (currentPosition === null) return 2000;
    if (currentPosition <= 10) return 1000;
    if (currentPosition <= 50) return 2000;
    if (currentPosition <= 200) return 3000;
    return 5000;
  };

  // 재귀적으로 상태 확인
  const pollStatus = async () => {
    try {
      const status = await queueApi.getStatus(Number(eventId));
      
      if (!status.in_queue && status.queue_token) {
        // 대기열 통과
        localStorage.setItem(`queueToken:${eventId}`, status.queue_token);
        navigate(`/event/${eventId}`);
        return;
      }
      
      if (status.in_queue) {
        // 상태 업데이트
        setPosition(status.position);
        setTotal(status.total);
        setEstimatedWaitTime(status.estimated_wait_time || 0);
        
        // 다음 폴링 예약 (현재 순서에 맞는 간격으로)
        const nextInterval = getPollingInterval(status.position);
        timeoutRef.current = setTimeout(pollStatus, nextInterval);
      }
    } catch (error) {
      console.error("대기열 상태 확인 실패:", error);
      // 에러 발생 시에도 재시도 (5초 후)
      timeoutRef.current = setTimeout(pollStatus, 5000);
    }
  };

  useEffect(() => {
    if (!eventId) return;

    // 초기 대기열 진입
    const enterQueue = async () => {
      try {
        const response = await queueApi.enter(Number(eventId));
        
        if (!response.in_queue && response.queue_token) {
          localStorage.setItem(`queueToken:${eventId}`, response.queue_token);
          navigate(`/event/${eventId}`);
          return;
        }
        
        if (response.in_queue) {
          setPosition(response.position);
          setTotal(response.total);
          setEstimatedWaitTime(response.estimated_wait_time || 0);
        }
      } catch (error) {
        console.error("대기열 진입 실패:", error);
      }
    };

    enterQueue();

    // 초기 폴링 시작
    pollStatus();

    // 정리 함수
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [eventId, navigate]);

  // ... UI 렌더링 ...
};
```

#### 동작 예시

```
시나리오: 사용자가 대기열에 진입

초기: 순서 500번
  → 폴링 간격: 5초
  → 5초마다 확인

100번으로 이동
  → 폴링 간격: 3초 (자동 조정)
  → 3초마다 확인

50번으로 이동
  → 폴링 간격: 2초 (자동 조정)
  → 2초마다 확인

10번으로 이동
  → 폴링 간격: 1초 (자동 조정)
  → 1초마다 확인 (빠르게 반응)

순서 도착 (0번)
  → 대기열 통과
  → 폴링 중지
```

#### 장점

1. **서버 부하 감소**
   - 멀리 있는 사용자는 덜 자주 요청
   - 가까운 사용자만 자주 요청
   - 전체적으로 서버 부하 감소

2. **사용자 경험 향상**
   - 곧 순서일 때 빠르게 반응
   - 멀리 있을 때는 배터리 절약

3. **자동 최적화**
   - 순서가 변경되면 자동으로 간격 조정
   - 수동 설정 불필요

#### 주의사항

1. **position 변경 시 interval 재설정**
   - `useEffect`에서 `position`을 dependency로 추가
   - position이 변경될 때마다 interval 재설정

2. **메모리 누수 방지**
   - 컴포넌트 언마운트 시 interval 정리
   - `useRef`로 interval 참조 저장

3. **에러 처리**
   - 네트워크 오류 시에도 재시도
   - 최대 재시도 횟수 제한

### 최적화된 폴링 구현 (완전한 버전)

```typescript
// frontend/src/pages/QueuePage.tsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { queueApi } from "../services/api";

const QueuePage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [position, setPosition] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(0);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  // 폴링 간격 계산
  const getPollingInterval = (currentPosition: number | null): number => {
    if (currentPosition === null) return 2000; // 초기: 2초
    if (currentPosition <= 10) return 1000;   // 곧 순서: 1초
    if (currentPosition <= 50) return 2000;  // 가까움: 2초
    if (currentPosition <= 200) return 3000;  // 중간: 3초
    return 5000;                              // 멀리: 5초
  };

  // 상태 확인 함수
  const pollStatus = async () => {
    try {
      const status = await queueApi.getStatus(Number(eventId));
      
      // 성공 시 재시도 카운트 리셋
      retryCountRef.current = 0;
      
      if (!status.in_queue && status.queue_token) {
        // 대기열 통과
        localStorage.setItem(`queueToken:${eventId}`, status.queue_token);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        navigate(`/event/${eventId}`);
        return;
      }
      
      if (status.in_queue) {
        // 상태 업데이트
        setPosition(status.position);
        setTotal(status.total);
        setEstimatedWaitTime(status.estimated_wait_time || 0);
        
        // 다음 폴링 예약 (현재 순서에 맞는 간격으로)
        const nextInterval = getPollingInterval(status.position);
        timeoutRef.current = setTimeout(pollStatus, nextInterval);
      }
    } catch (error) {
      console.error("대기열 상태 확인 실패:", error);
      retryCountRef.current++;
      
      // 최대 재시도 횟수 초과 시 에러 처리
      if (retryCountRef.current >= MAX_RETRIES) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        alert("대기열 상태를 확인할 수 없습니다. 페이지를 새로고침해주세요.");
        return;
      }
      
      // 에러 발생 시 5초 후 재시도
      timeoutRef.current = setTimeout(pollStatus, 5000);
    }
  };

  useEffect(() => {
    if (!eventId) return;

    // 초기 대기열 진입
    const enterQueue = async () => {
      try {
        const response = await queueApi.enter(Number(eventId));
        
        if (!response.in_queue && response.queue_token) {
          localStorage.setItem(`queueToken:${eventId}`, response.queue_token);
          navigate(`/event/${eventId}`);
          return;
        }
        
        if (response.in_queue) {
          setPosition(response.position);
          setTotal(response.total);
          setEstimatedWaitTime(response.estimated_wait_time || 0);
        }
      } catch (error) {
        console.error("대기열 진입 실패:", error);
      }
    };

    enterQueue();

    // 초기 폴링 시작
    pollStatus();

    // 정리 함수
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [eventId, navigate]);

  // ... UI 렌더링 ...
};
```

**최적화 포인트:**
1. **동적 폴링 간격**: 순서에 따라 간격 자동 조정
2. **에러 처리**: 재시도 로직 추가
3. **메모리 누수 방지**: timeout 정리
4. **서버 부하 감소**: 멀리 있는 사용자는 덜 자주 요청

### 결론

**대기열 상태 조회에는 폴링을 권장합니다.**

- ✅ 구현이 간단
- ✅ 서버 부하 완화 가능 (캐싱)
- ✅ 확장이 쉬움
- ✅ 2-5초 지연은 허용 가능

웹소켓은 완벽한 실시간이 필요한 경우(예: 채팅, 주식 가격)에만 사용하는 것이 좋습니다.

## 참고 자료

- Redis Sorted Set을 활용한 대기열 구현
- FastAPI Middleware 활용
- Rate Limiting 패턴 (Token Bucket, Sliding Window)
- 폴링 최적화 기법
