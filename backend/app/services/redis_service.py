"""
Redis 서비스: 분산 LOCK 및 캐싱 관리
고트래픽 환경에서 좌석 예매 동시성 제어를 위한 Redis 기반 서비스
"""
import redis
import time
import uuid
from typing import Optional
from contextlib import contextmanager
from app.core.config import settings

class RedisService:
    """Redis 분산 LOCK 및 캐싱 서비스"""
    
    def __init__(self):
        self.client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=settings.REDIS_PASSWORD,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True
        )
    
    def ping(self) -> bool:
        """Redis 연결 확인"""
        try:
            return self.client.ping()
        except Exception:
            return False
    
    @contextmanager
    def lock_seat(self, ticket_id: int, timeout: int = None):
        """
        좌석 LOCK 획득 (Context Manager)
        
        Args:
            ticket_id: 티켓 ID
            timeout: LOCK 타임아웃 (초), 기본값은 설정값 사용
            
        Yields:
            bool: LOCK 획득 성공 여부
            
        Raises:
            Exception: LOCK 획득 실패 시
        """
        lock_key = f"seat_lock:{ticket_id}"
        lock_value = str(uuid.uuid4())
        lock_timeout = timeout or settings.SEAT_LOCK_TIMEOUT
        
        acquired = False
        try:
            # SET NX EX: 키가 없을 때만 설정하고 만료 시간 설정
            acquired = self.client.set(
                lock_key, 
                lock_value, 
                nx=True, 
                ex=lock_timeout
            )
            
            if not acquired:
                raise Exception(f"Failed to acquire lock for seat {ticket_id}")
            
            yield acquired
            
        finally:
            # LOCK 해제 (Lua 스크립트로 원자적 연산)
            if acquired:
                # 자신이 설정한 값인지 확인 후 삭제 (다른 프로세스가 만료 후 재획득한 경우 방지)
                lua_script = """
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
                """
                self.client.eval(lua_script, 1, lock_key, lock_value)
    
    def try_lock_seat(self, ticket_id: int, timeout: int = None, user_id: int = None) -> bool:
        """
        좌석 LOCK 시도 (논블로킹)
        
        Args:
            ticket_id: 티켓 ID
            timeout: LOCK 타임아웃 (초)
            user_id: 사용자 ID (같은 사용자의 중복 요청 허용용)
            
        Returns:
            bool: LOCK 획득 성공 여부
        """
        lock_key = f"seat_lock:{ticket_id}"
        lock_timeout = timeout or settings.SEAT_LOCK_TIMEOUT
        
        try:
            # 사용자 ID가 있으면 LOCK 값에 포함
            if user_id:
                lock_value = f"{user_id}:{uuid.uuid4()}"
            else:
                lock_value = str(uuid.uuid4())
            
            return bool(self.client.set(
                lock_key,
                lock_value,
                nx=True,
                ex=lock_timeout
            ))
        except Exception:
            return False
    
    def unlock_seat(self, ticket_id: int, user_id: Optional[int] = None):
        """
        좌석 LOCK 해제
        
        Args:
            ticket_id: 티켓 ID
            user_id: 사용자 ID (제공되면 해당 사용자의 LOCK만 해제)
        """
        lock_key = f"seat_lock:{ticket_id}"
        try:
            if user_id:
                # 사용자 ID가 제공되면 해당 사용자의 LOCK만 해제
                lock_value = self.client.get(lock_key)
                if lock_value and ":" in lock_value:
                    lock_user_id = int(lock_value.split(":")[0])
                    if lock_user_id == user_id:
                        self.client.delete(lock_key)
            else:
                # 사용자 ID가 없으면 무조건 삭제
                self.client.delete(lock_key)
        except Exception:
            pass
    
    def get_lock_user_id(self, ticket_id: int) -> Optional[int]:
        """
        LOCK을 가지고 있는 사용자 ID 조회
        
        Args:
            ticket_id: 티켓 ID
            
        Returns:
            Optional[int]: 사용자 ID, LOCK이 없거나 형식이 맞지 않으면 None
        """
        lock_key = f"seat_lock:{ticket_id}"
        try:
            lock_value = self.client.get(lock_key)
            if lock_value and ":" in lock_value:
                user_id_str = lock_value.split(":")[0]
                return int(user_id_str)
        except (ValueError, AttributeError, TypeError) as e:
            # 디버깅: 형식 오류 로깅
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to parse lock user ID for ticket_id={ticket_id}, lock_value={lock_value}, error={e}")
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error getting lock user ID for ticket_id={ticket_id}: {e}")
        return None
    
    def cache_seat_status(self, event_id: int, schedule_id: Optional[int], seat_key: str, available: bool, ttl: int = 300):
        """
        좌석 상태 캐싱
        
        Args:
            event_id: 이벤트 ID
            schedule_id: 스케줄 ID
            seat_key: 좌석 키 (예: "1열-5")
            available: 예약 가능 여부
            ttl: 캐시 만료 시간 (초, 기본 5분)
        """
        cache_key = self._get_seat_cache_key(event_id, schedule_id, seat_key)
        try:
            self.client.setex(cache_key, ttl, "1" if available else "0")
        except Exception:
            pass
    
    def get_seat_status(self, event_id: int, schedule_id: Optional[int], seat_key: str) -> Optional[bool]:
        """
        캐시된 좌석 상태 조회
        
        Returns:
            bool: 예약 가능 여부, None: 캐시 미스
        """
        cache_key = self._get_seat_cache_key(event_id, schedule_id, seat_key)
        try:
            value = self.client.get(cache_key)
            if value is None:
                return None
            return value == "1"
        except Exception:
            return None
    
    def invalidate_seat_cache(self, event_id: int, schedule_id: Optional[int] = None):
        """
        좌석 상태 캐시 무효화
        
        Args:
            event_id: 이벤트 ID
            schedule_id: 스케줄 ID (None이면 해당 이벤트의 모든 스케줄)
        """
        pattern = f"seat_status:{event_id}:*" if schedule_id is None else f"seat_status:{event_id}:{schedule_id}:*"
        try:
            keys = self.client.keys(pattern)
            if keys:
                self.client.delete(*keys)
        except Exception:
            pass
    
    def cache_event_seats(self, event_id: int, schedule_id: Optional[int], seats_data: dict, ttl: int = 60):
        """
        이벤트 좌석 목록 캐싱 (전체 좌석 정보)
        
        Args:
            event_id: 이벤트 ID
            schedule_id: 스케줄 ID
            seats_data: 좌석 데이터 딕셔너리
            ttl: 캐시 만료 시간 (초, 기본 1분)
        """
        import json
        cache_key = f"event_seats:{event_id}:{schedule_id or 'all'}"
        try:
            self.client.setex(cache_key, ttl, json.dumps(seats_data))
        except Exception:
            pass
    
    def get_cached_event_seats(self, event_id: int, schedule_id: Optional[int]) -> Optional[dict]:
        """캐시된 이벤트 좌석 목록 조회"""
        import json
        cache_key = f"event_seats:{event_id}:{schedule_id or 'all'}"
        try:
            data = self.client.get(cache_key)
            if data:
                return json.loads(data)
        except Exception:
            pass
        return None
    
    def _get_seat_cache_key(self, event_id: int, schedule_id: Optional[int], seat_key: str) -> str:
        """좌석 캐시 키 생성"""
        schedule_part = str(schedule_id) if schedule_id else "all"
        return f"seat_status:{event_id}:{schedule_part}:{seat_key}"


# 싱글톤 인스턴스
redis_service = RedisService()

