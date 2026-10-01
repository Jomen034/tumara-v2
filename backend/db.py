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
# When true, a failed MongoDB connection aborts the boot instead of falling back
# to an in-memory mock (which silently loses all data on every restart).
# Recommended for local dev. In production the fallback is kept on purpose so a
# paused free-tier Atlas cluster degrades instead of taking the service down.
strict_db = os.environ.get("DB_STRICT", "").lower() in ("true", "1")

if is_testing:
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
    _in_memory = True
    _last_db_error = "testing environment (mongomock)"
    print(f"[DB] Using AsyncMongoMockClient for test environment.")
else:
    # Quick connectivity probe with a short timeout; fall back to in-memory mock
    # if the configured MongoDB is unreachable (paused free-tier Atlas, cold Render boot, etc.)
    try:
        import pymongo
        probe_kwargs = {**client_kwargs, "serverSelectionTimeoutMS": 5000}
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
            raise
        print(
            f"[DB] MongoDB unavailable ({type(e).__name__}: {str(e)[:120]}). Using in-memory Mongo mock.\n"
            f"[DB] !!! PERINGATAN: semua data HILANG setiap restart. Data lama tidak bisa dipulihkan.\n"
            f"[DB] !!! Set DB_STRICT=true untuk gagal keras, atau perbaiki koneksi MONGO_URL."
        )
        from mongomock_motor import AsyncMongoMockClient
        client = AsyncMongoMockClient()

db = client[db_name]


