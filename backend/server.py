import os
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router, get_current_user
from models import User
from routes_finance import router as finance_router
from routes_ai import router as ai_router
from routes_household import router as household_router
from routes_bills import router as bills_router

app = FastAPI(title="Tumara — Personal AI Finance CFO")

api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"status": "ok", "app": "Tumara CFO API"}


@api.get("/health")
async def health(request: Request):
    """Health check publik. Rincian error koneksi DB hanya untuk admin.

    Penting untuk operasi: membedakan "MongoDB terhubung" dari "jatuh ke
    in-memory mock" yang akan menghapus semua data saat restart.
    """
    from db import db, mongo_url, db_name
    from db import _in_memory, _last_db_error
    import pymongo

    info = {"status": "ok", "db_name": db_name, "storage": "in-memory-mock" if _in_memory else "mongodb"}
    if _in_memory:
        info["status"] = "degraded"
        info["detail"] = "MongoDB tidak terhubung; memakai database in-memory (data hilang saat restart)"
        tok = request.headers.get("Authorization", "")
        if tok.startswith("Bearer "):
            try:
                user = await get_current_user(request)
            except HTTPException:
                user = None
            if user and user.role == "admin":
                info["error"] = _last_db_error
    return info


@api.get("/admin/db-stats")
async def db_stats(user: User = Depends(get_current_user)):
    is_prod = os.environ.get("ENVIRONMENT", "").lower() in ("production", "prod", "true", "1")
    allow_stats = os.environ.get("ALLOW_ADMIN_STATS", "").lower() in ("true", "1")
    if is_prod and not allow_stats:
        raise HTTPException(status_code=403, detail="Admin db-stats endpoint disabled in production")

    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak: Hanya admin yang diizinkan")

    from db import db, db_name
    try:
        cols = await db.list_collection_names()
        col_data = {}
        for c in sorted(cols):
            docs = await db[c].find({}, {"_id": 0, "password_hash": 0, "session_token": 0}).to_list(500)
            col_data[c] = {
                "count": len(docs),
                "documents": docs
            }
        return {
            "status": "ok",
            "db_name": db_name,
            "collections_count": len(cols),
            "collections": col_data
        }
    except Exception as e:
        return {"error": f"Failed to list collections in {db_name}: {e}"}


api.include_router(auth_router)
api.include_router(finance_router)
api.include_router(ai_router)
api.include_router(household_router)
api.include_router(bills_router)
app.include_router(api)


@app.on_event("startup")
async def on_startup():
    from db import init_db_indexes, db
    await init_db_indexes()
    try:
        await db.transactions.update_many(
            {"type": "transfer", "$or": [{"category": "Lainnya"}, {"category": {"$exists": False}}, {"category": None}]},
            {"$set": {"category": "Transfer"}}
        )
    except Exception as e:
        print(f"[Startup Migration] Warning updating transfer categories: {e}")

raw_origins = os.environ.get("CORS_ORIGINS", "")
parsed_origins = [o.strip().rstrip("/") for o in raw_origins.split(",") if o.strip() and o.strip() != "*"]
for default_origin in ("https://tumara-v2.vercel.app", "https://tumara.vercel.app", "http://localhost:3000"):
    if default_origin not in parsed_origins:
        parsed_origins.append(default_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=parsed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app|http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
