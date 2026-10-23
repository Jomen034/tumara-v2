import os
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router, get_current_user
from models import User
from routes_finance import router as finance_router
from routes_ai import router as ai_router
from routes_household import router as household_router
from routes_bills import router as bills_router
from routes_orders import router as orders_router

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
api.include_router(orders_router)
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

    # Normalize Groceries category names across all transactions
    try:
        await db.transactions.update_many(
            {"category": {"$in": ["Groceries", "Supermarket", "Kebutuhan Rumah", "Belanja Bulanan"]}},
            {"$set": {"category": "Groceries & Kebutuhan Rumah"}}
        )
    except Exception as e:
        print(f"[Startup Migration] Warning normalizing groceries: {e}")

    # Restore Grand Lucky factual receipt date to 2026-09-24 if it was previously set to 2026-10-01
    try:
        await db.transactions.update_many(
            {"note": {"$regex": "grand lucky|grandlucky", "$options": "i"}, "date": "2026-10-01"},
            {"$set": {"date": "2026-09-24"}}
        )
    except Exception as e:
        print(f"[Startup Migration] Warning restoring Grand Lucky date: {e}")

    # Re-categorize Car Loan & installments from Transportasi to "Cicilan & Pinjaman"
    try:
        await db.transactions.update_many(
            {"note": {"$regex": "car loan|cicilan mobil|kredit mobil|leasing|kpr", "$options": "i"},
             "category": {"$in": ["Transportasi", "Lainnya", "Tagihan & Utilitas"]}},
            {"$set": {"category": "Cicilan & Pinjaman"}}
        )
        await db.bills.update_many(
            {"name": {"$regex": "car loan|cicilan mobil|kredit mobil|leasing|kpr", "$options": "i"}},
            {"$set": {"category": "Cicilan & Pinjaman"}}
        )
    except Exception as e:
        print(f"[Startup Migration] Warning updating car loan categories: {e}")

    # One-time reconciliation for Bethsaida Clinic transaction and Mandiri CC phantom ledger drift
    try:
        bethsaida_txn = await db.transactions.find_one({"note": {"$regex": "bethsaida", "$options": "i"}})
        if bethsaida_txn and float(bethsaida_txn.get("amount", 0)) == 1:
            await db.transactions.update_one({"id": bethsaida_txn["id"]}, {"$set": {"amount": 400000}})
            print("[Startup Reconciliation] Corrected Bethsaida Clinic transaction to Rp 400.000.")

        # Reconcile Mandiri CC if inflated by the 11-click phantom leak (around 4.977.045 -> 977.055)
        mandiri_wal = await db.wallets.find_one({"name": {"$regex": "mandiri cc", "$options": "i"}})
        if mandiri_wal and (mandiri_wal.get("balance", 0) in (3377049, 4977045) or mandiri_wal.get("balance", 0) > 3000000):
            # Correct balance: initial 577.056 + legitimate 1x edit (400.000 - 1) = 977.055
            await db.wallets.update_one({"id": mandiri_wal["id"]}, {"$set": {"balance": 977055}})
            from ledger import snapshot_networth
            if mandiri_wal.get("household_id"):
                await snapshot_networth(mandiri_wal["household_id"])
            print("[Startup Reconciliation] Corrected Mandiri CC balance to Rp 977.055.")
    except Exception as e:
        print(f"[Startup Reconciliation] Notice: {e}")

from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    origin = request.headers.get("origin") or "https://tumara-v2.vercel.app"
    return JSONResponse(
        status_code=500,
        content={"detail": f"Terjadi kesalahan di server: {str(exc)[:120]}"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

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
