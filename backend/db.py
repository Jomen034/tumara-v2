import os
import certifi
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "fincfo_db")

# Longer timeouts to accommodate free-tier cold starts (paused Atlas clusters, Render cold boots)
client_kwargs = {"serverSelectionTimeoutMS": 30000, "connectTimeoutMS": 30000, "socketTimeoutMS": 30000}
if "mongodb+srv" in mongo_url or "ssl=true" in mongo_url.lower() or "tls=true" in mongo_url.lower():
    client_kwargs["tlsCAFile"] = certifi.where()

is_testing = os.environ.get("TESTING", "").lower() in ("true", "1") or os.environ.get("PYTEST_CURRENT_TEST") is not None
# When strict_db is true, a failed MongoDB connection aborts the boot instead of
# silently falling back to an in-memory mock (which loses all data on every restart).
strict_db = os.environ.get("DB_STRICT", "").lower() in ("true", "1") or (
    os.environ.get("ENVIRONMENT", "").lower() in ("production", "prod")
    and os.environ.get("ALLOW_DB_FALLBACK", "").lower() not in ("true", "1")
)

if is_testing:
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
    _in_memory = True
    _last_db_error = "testing environment (mongomock)"
    print(f"[DB] Using AsyncMongoMockClient for test environment.")
else:
    # Quick connectivity probe with a 10s timeout to allow DNS/TLS handshake
    # on cold-starting free-tier clusters
    try:
        import pymongo
        probe_kwargs = {**client_kwargs, "serverSelectionTimeoutMS": 10000}
        sync_client = pymongo.MongoClient(mongo_url, **probe_kwargs)
        sync_client.admin.command('ping')
        client = AsyncIOMotorClient(mongo_url, **client_kwargs)
        _in_memory = False
        _last_db_error = None
        print(f"[DB] Connected to MongoDB for {db_name}")
    except Exception as e:
        _in_memory = True
        _last_db_error = f"{type(e).__name__}: {str(e)[:300]}"
        if strict_db:
            print(f"[DB] FATAL: Failed to connect to MongoDB ({_last_db_error}). Aborting boot because strict_db is enabled.")
            raise
        print(
            f"[DB] MongoDB unavailable ({type(e).__name__}: {str(e)[:120]}). Using in-memory Mongo mock.\n"
            f"[DB] !!! PERINGATAN: semua data HILANG setiap restart. Data lama tidak bisa dipulihkan.\n"
            f"[DB] !!! Set DB_STRICT=true untuk gagal keras, atau perbaiki koneksi MONGO_URL."
        )
        from mongomock_motor import AsyncMongoMockClient
        client = AsyncMongoMockClient()

db = client[db_name]


async def init_db_indexes():
    """Ensure essential uniqueness and TTL indexes exist in MongoDB."""
    if _in_memory:
        return
    try:
        # Unique constraint on user email
        await db.users.create_index("email", unique=True, sparse=True)
        # Unique session token and TTL automatic expiration
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        # Fast query indexes for financial records
        await db.transactions.create_index([("household_id", 1), ("date", -1)])
        await db.wallets.create_index("household_id")
        print(f"[DB] Database indexes verified.")
    except Exception as exc:
        print(f"[DB] Index verification notice: {exc}")


