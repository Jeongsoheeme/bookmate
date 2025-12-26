from fastapi import APIRouter
from app.api.v1.endpoints import users, events, banners

api_router = APIRouter()

api_router.include_router(users.router, prefix="/auth", tags=["auth"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(banners.router, prefix="/banners", tags=["banners"])