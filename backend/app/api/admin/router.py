from fastapi import APIRouter
from app.api.admin.endpoints import admin_users, events, venues, banners

admin_router = APIRouter()

admin_router.include_router(admin_users.router, prefix="/users", tags=["[admin] users"])
admin_router.include_router(events.router, prefix="/events", tags=["[admin] events"])
admin_router.include_router(venues.router, prefix="/venues", tags=["[admin] venues"])
admin_router.include_router(banners.router, prefix="/banners", tags=["[admin] banners"])
