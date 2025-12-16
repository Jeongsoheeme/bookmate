from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.api.admin.router import admin_router

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

app.include_router(api_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/admin")  

@app.get("/")
async def root():
  return {"message": "Welcome to Bookmate API"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}
