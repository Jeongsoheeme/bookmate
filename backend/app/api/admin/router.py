from fastapi import APIRouter
from app.api.admin.endpoints import admin_users

admin_router = APIRouter()

admin_router.include_router(admin_users.router, prefix="/users", tags=["[admin] users"])
