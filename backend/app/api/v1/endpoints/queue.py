"""
대기열 진입 및 상태 조회 API - 배치 처리 기반
"""
from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.event import Event
from app.services.redis_service import redis_service
from app.database import get_db
from sqlalchemy.orm import Session
import time
import secrets

router = APIRouter()

# Lua 스크립트: 배치 진행을 원자적으로 수행
# KEYS[1] = queue_batch_last_time:event:{eid}
# KEYS[2] = queue_batch_cursor:event:{eid}
# KEYS[3] = queue:event:{eid}
# ARGV[1] = batch_interval (초)
# ARGV[2] = batch_size
# ARGV[3] = current_time
# 반환: 새 커서 값 (진행된 경우) 또는 기존 커서 값 (진행 안 된 경우)
BATCH_ADVANCE_LUA = """
local last_time_key = KEYS[1]
local cursor_key = KEYS[2]
local queue_key = KEYS[3]
local batch_interval = tonumber(ARGV[1])
local batch_size = tonumber(ARGV[2])
local current_time = tonumber(ARGV[3])

-- 마지막 배치 시각 확인
local last_time = tonumber(redis.call('GET', last_time_key) or '0')
if last_time == nil then last_time = 0 end

-- 배치 간격이 경과하지 않았으면 현재 커서 반환
if (current_time - last_time) < batch_interval then
    local cursor = redis.call('GET', cursor_key)
    if cursor == false then return '0' end
    return cursor
end

-- 현재 커서 조회
local cursor = tonumber(redis.call('GET', cursor_key) or '0')
if cursor == nil then cursor = 0 end

-- 커서 이후 N명 조회 (score 기반)
local members
if cursor == 0 then
    -- 처음이면 가장 앞 N명
    members = redis.call('ZRANGEBYSCORE', queue_key, '-inf', '+inf', 'WITHSCORES', 'LIMIT', 0, batch_size)
else
    -- 커서 이후 N명 (커서 score 초과)
    members = redis.call('ZRANGEBYSCORE', queue_key, '(' .. tostring(cursor), '+inf', 'WITHSCORES', 'LIMIT', 0, batch_size)
end

-- 조회된 멤버가 없으면 현재 커서 유지
if #members == 0 then
    -- 시간만 갱신 (빈 배치 반복 방지)
    redis.call('SET', last_time_key, tostring(current_time))
    redis.call('EXPIRE', last_time_key, 86400)
    local cur = redis.call('GET', cursor_key)
    if cur == false then return '0' end
    return cur
end

-- 마지막 멤버의 score를 새 커서로 설정
local new_cursor = members[#members]  -- 마지막 score

-- 원자적으로 커서와 시간 갱신
redis.call('SET', cursor_key, tostring(new_cursor))
redis.call('EXPIRE', cursor_key, 86400)
redis.call('SET', last_time_key, tostring(current_time))
redis.call('EXPIRE', last_time_key, 86400)

return tostring(new_cursor)
"""


async def _try_advance_batch(event_id: int) -> float:
    """
    배치 진행 시도 (Lua 스크립트로 원자적 실행)
    반환: 현재 커서 값 (score)
    """
    last_time_key = f"queue_batch_last_time:event:{event_id}"
    cursor_key = f"queue_batch_cursor:event:{event_id}"
    queue_key = f"queue:event:{event_id}"

    current_time = time.time()
    result = redis_service.client.eval(
        BATCH_ADVANCE_LUA,
        3,
        last_time_key, cursor_key, queue_key,
        settings.QUEUE_BATCH_INTERVAL,
        settings.QUEUE_BATCH_SIZE,
        current_time
    )
    return float(result)


def _is_user_released(event_id: int, user_id: int, cursor: float) -> bool:
    """
    사용자가 배치 커서를 통과했는지 확인
    user_score <= cursor 이면 통과
    """
    queue_key = f"queue:event:{event_id}"
    user_score = redis_service.client.zscore(queue_key, str(user_id))
    if user_score is None:
        # 대기열에 없음 (이미 제거되었거나 진입하지 않음)
        return False
    if cursor <= 0:
        return False
    return user_score <= cursor


async def _issue_queue_token(event_id: int, user_id: int) -> str:
    """대기열 토큰 발급"""
    token = secrets.token_urlsafe(32)
    token_key = f"queue_token:event:{event_id}:user:{user_id}"
    redis_service.client.setex(token_key, settings.QUEUE_TOKEN_TTL, token)
    return token


async def _record_queue_processing(event_id: int):
    """대기열 처리 완료 기록 (통계용)"""
    try:
        history_key = f"queue_history:event:{event_id}"
        current_time = time.time()
        redis_service.client.zadd(history_key, {str(current_time): current_time})
        # 오래된 데이터 삭제 (1시간 이상)
        one_hour_ago = current_time - 3600
        redis_service.client.zremrangebyscore(history_key, 0, one_hour_ago)
        redis_service.client.expire(history_key, 86400)
    except Exception:
        pass


async def _get_recent_processing_rate(event_id: int) -> float:
    """최근 처리 속도 계산 (명/초)"""
    try:
        history_key = f"queue_history:event:{event_id}"
        current_time = time.time()
        one_minute_ago = current_time - 60
        processed_count = redis_service.client.zcount(
            history_key, one_minute_ago, current_time
        )
        if processed_count > 0:
            return processed_count / 60.0
        return 0.0
    except Exception:
        return 0.0


async def _calculate_estimated_wait_time(event_id: int, position: int) -> int:
    """
    배치 기반 예상 대기 시간 계산
    """
    batch_size = settings.QUEUE_BATCH_SIZE
    batch_interval = settings.QUEUE_BATCH_INTERVAL

    # 배치 기반 기본 추정
    batches_ahead = max(0, (position - 1)) // batch_size
    base_estimate = batches_ahead * batch_interval

    # 최근 처리 속도가 있으면 가중 평균으로 보정
    recent_rate = await _get_recent_processing_rate(event_id)
    if recent_rate > 0:
        rate_estimate = int(position / recent_rate)
        # 가중 평균: 배치 기반 60%, 실측 40%
        estimated = int(base_estimate * 0.6 + rate_estimate * 0.4)
        return max(estimated, 0)

    return max(base_estimate, 0)


def validate_queue_token(event_id: int, user_id: int, token: str) -> bool:
    """
    대기열 토큰 검증 - O(1) 직접 조회
    events.py, tickets.py에서 import하여 사용
    """
    token_key = f"queue_token:event:{event_id}:user:{user_id}"
    try:
        stored_token = redis_service.client.get(token_key)
        return stored_token == token
    except Exception:
        return False


@router.post("/queue/enter/{event_id}")
async def enter_queue(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """대기열 진입"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # 비인기 이벤트 → 즉시 토큰 발급
    if not event.is_hot and not getattr(event, 'queue_enabled', False):
        token = await _issue_queue_token(event_id, current_user.id)
        return {
            "in_queue": False,
            "queue_token": token,
            "position": 0,
            "total": 0,
            "batch_size": settings.QUEUE_BATCH_SIZE,
            "batch_interval": settings.QUEUE_BATCH_INTERVAL,
        }

    queue_key = f"queue:event:{event_id}"

    try:
        # 이미 대기열에 있는지 확인
        existing_score = redis_service.client.zscore(queue_key, str(current_user.id))

        if existing_score is None:
            # 새로 대기열 진입
            timestamp = time.time()
            redis_service.client.zadd(queue_key, {str(current_user.id): timestamp})

        # 기회적 배치 진행
        cursor = await _try_advance_batch(event_id)

        # 통과 여부 확인
        if _is_user_released(event_id, current_user.id, cursor):
            token = await _issue_queue_token(event_id, current_user.id)
            redis_service.client.zrem(queue_key, str(current_user.id))
            await _record_queue_processing(event_id)
            return {
                "in_queue": False,
                "queue_token": token,
                "position": 0,
                "total": redis_service.client.zcard(queue_key),
                "batch_size": settings.QUEUE_BATCH_SIZE,
                "batch_interval": settings.QUEUE_BATCH_INTERVAL,
            }

        # 아직 대기 중
        position = redis_service.client.zrank(queue_key, str(current_user.id))
        total = redis_service.client.zcard(queue_key)
        pos = (position + 1) if position is not None else total
        estimated_wait_time = await _calculate_estimated_wait_time(event_id, pos)

        return {
            "in_queue": True,
            "queue_token": None,
            "position": pos,
            "total": total,
            "estimated_wait_time": estimated_wait_time,
            "batch_size": settings.QUEUE_BATCH_SIZE,
            "batch_interval": settings.QUEUE_BATCH_INTERVAL,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/queue/status/{event_id}")
async def get_queue_status(
    event_id: int,
    current_user: User = Depends(get_current_user)
):
    """대기열 상태 조회 (이벤트 단위 캐시 제거 - 데이터 누출 방지)"""
    queue_key = f"queue:event:{event_id}"

    try:
        # 배치 진행 시도
        cursor = await _try_advance_batch(event_id)

        # 현재 사용자의 대기 순서 확인
        position = redis_service.client.zrank(queue_key, str(current_user.id))
        total = redis_service.client.zcard(queue_key)

        if position is None:
            # 대기열에 없음
            return {
                "in_queue": False,
                "position": None,
                "total": total,
                "batch_size": settings.QUEUE_BATCH_SIZE,
                "batch_interval": settings.QUEUE_BATCH_INTERVAL,
            }

        # 통과 여부 확인
        if _is_user_released(event_id, current_user.id, cursor):
            # 대기열 통과 → 토큰 발급
            token = await _issue_queue_token(event_id, current_user.id)
            redis_service.client.zrem(queue_key, str(current_user.id))
            await _record_queue_processing(event_id)

            return {
                "in_queue": False,
                "queue_token": token,
                "position": 0,
                "total": total,
                "batch_size": settings.QUEUE_BATCH_SIZE,
                "batch_interval": settings.QUEUE_BATCH_INTERVAL,
            }

        # 아직 대기 중
        pos = position + 1
        estimated_wait_time = await _calculate_estimated_wait_time(event_id, pos)

        return {
            "in_queue": True,
            "queue_token": None,
            "position": pos,
            "total": total,
            "estimated_wait_time": estimated_wait_time,
            "batch_size": settings.QUEUE_BATCH_SIZE,
            "batch_interval": settings.QUEUE_BATCH_INTERVAL,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
