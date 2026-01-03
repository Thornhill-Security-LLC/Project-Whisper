from fastapi import APIRouter
from app.api.routes.organisation import router as organisation_router
from app.api.routes.user_account import router as user_router

api_router = APIRouter()
api_router.include_router(organisation_router)
api_router.include_router(user_router)
