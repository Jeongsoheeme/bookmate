from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    UPLOAD_DIR: str = "uploads"
    # Redis 설정
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str | None = None
    # 좌석 LOCK 타임아웃 (초) - 예매 정보 입력 시간을 고려하여 2분으로 증가
    SEAT_LOCK_TIMEOUT: int = 120
    # 대기열 배치 처리 설정
    QUEUE_BATCH_SIZE: int = 50       # 배치당 통과 인원
    QUEUE_BATCH_INTERVAL: int = 10   # 배치 간격 (초)
    QUEUE_TOKEN_TTL: int = 600       # 토큰 유효기간 (초, 10분)
    # OpenAI 설정 (선택적)
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str | None = None
    
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"  # 정의되지 않은 필드는 무시
    )


settings = Settings()
