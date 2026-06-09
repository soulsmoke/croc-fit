"""API v1 router — aggregates all domain routers."""

from fastapi import APIRouter

from croc_fit_api.api.v1.attachments import router as attachments_router
from croc_fit_api.api.v1.biometrics import router as biometrics_router
from croc_fit_api.api.v1.chat import router as chat_router
from croc_fit_api.api.v1.health import router as health_router
from croc_fit_api.api.v1.insights import router as insights_router
from croc_fit_api.api.v1.nutrition import meals_router
from croc_fit_api.api.v1.nutrition import router as nutrition_router
from croc_fit_api.api.v1.prs import loads_router
from croc_fit_api.api.v1.prs import router as prs_router
from croc_fit_api.api.v1.workouts import blocks_router, calendar_router, exercises_router
from croc_fit_api.api.v1.workouts import router as workouts_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(health_router)
api_v1_router.include_router(chat_router)
api_v1_router.include_router(calendar_router)
api_v1_router.include_router(workouts_router)
api_v1_router.include_router(exercises_router)
api_v1_router.include_router(blocks_router)
api_v1_router.include_router(prs_router)
api_v1_router.include_router(loads_router)
api_v1_router.include_router(biometrics_router)
api_v1_router.include_router(nutrition_router)
api_v1_router.include_router(meals_router)
api_v1_router.include_router(attachments_router)
api_v1_router.include_router(insights_router)
