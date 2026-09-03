import os
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from routes_finance import router as finance_router
from routes_ai import router as ai_router

app = FastAPI(title="Nusa — Personal AI Finance CFO")

api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"status": "ok", "app": "Nusa CFO API"}


api.include_router(auth_router)
api.include_router(finance_router)
api.include_router(ai_router)
app.include_router(api)

origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
