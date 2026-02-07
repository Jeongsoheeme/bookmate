"""
Rate Limiting 미들웨어 (메인 페이지 보호용)
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.services.redis_service import redis_service


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate Limiting 미들웨어 (메인 페이지 보호용)"""
    
    # Rate Limiting이 필요한 엔드포인트
    RATE_LIMIT_ENDPOINTS = [
        "/api/v1/events",
        "/api/v1/banners",
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
