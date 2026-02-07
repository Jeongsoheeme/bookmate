from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import api_router
from app.api.admin.router import admin_router
from app.core.config import settings
from app.middleware.rate_limit_middleware import RateLimitMiddleware
import os

app = FastAPI(
  title="Bookmate API",
  description="티켓팅 플랫폼 API",
  version="1.0.0"
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=[
    "http://localhost:5173",  # frontend
    "http://localhost:5174",  # admin-frontend
  ],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# Rate Limiting 미들웨어 추가 (메인 페이지 보호용)
app.add_middleware(RateLimitMiddleware)

# 업로드 디렉토리 생성
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# 정적 파일 서빙 (업로드된 이미지 접근용)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

app.include_router(api_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/admin")  

@app.get("/")
async def root():
  return {"message": "Welcome to Bookmate API"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}
