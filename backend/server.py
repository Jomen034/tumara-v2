import os
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from routes_finance import router as finance_router
from routes_ai import router as ai_router
from routes_household import router as household_router
from routes_bills import router as bills_router

app = FastAPI(title="Nusa — Personal AI Finance CFO")

api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"status": "ok", "app": "Nusa CFO API"}


api.include_router(auth_router)
api.include_router(finance_router)
api.include_router(ai_router)
api.include_router(household_router)
api.include_router(bills_router)
app.include_router(api)

origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
