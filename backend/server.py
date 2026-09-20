import os
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from routes_finance import router as finance_router
from routes_ai import router as ai_router
from routes_household import router as household_router
from routes_bills import router as bills_router

app = FastAPI(title="Tumara — Personal AI Finance CFO")

api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"status": "ok", "app": "Tumara CFO API"}


@api.get("/admin/db-stats")
async def db_stats():
    from db import client, db
    try:
        db_names = await client.list_database_names()
    except Exception as e:
        return {"error": f"Failed to list databases: {e}"}

    all_dbs = {}
    for dname in db_names:
        if dname in ("admin", "local", "config"):
            continue
        cur_db = client[dname]
        try:
            cols = await cur_db.list_collection_names()
            col_data = {}
            for c in sorted(cols):
                docs = await cur_db[c].find({}, {"_id": 0, "password_hash": 0}).to_list(500)
                col_data[c] = {
                    "count": len(docs),
                    "documents": docs
                }
            all_dbs[dname] = {
                "collections_count": len(cols),
                "collections": col_data
            }
        except Exception as err:
            all_dbs[dname] = {"error": str(err)}

    return {"status": "ok", "databases": all_dbs}


api.include_router(auth_router)
api.include_router(finance_router)
api.include_router(ai_router)
api.include_router(household_router)
api.include_router(bills_router)
app.include_router(api)

raw_origins = os.environ.get("CORS_ORIGINS", "*")
origins = [o.strip().rstrip("/") for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app|http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
