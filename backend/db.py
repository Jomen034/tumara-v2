import os
import certifi
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "fincfo_db")

client_kwargs = {"serverSelectionTimeoutMS": 10000}
if "mongodb+srv" in mongo_url or "ssl=true" in mongo_url.lower() or "tls=true" in mongo_url.lower():
    client_kwargs["tlsCAFile"] = certifi.where()

is_prod = os.environ.get("ENVIRONMENT", "").lower() in ("production", "prod", "true", "1")
is_testing = os.environ.get("TESTING", "").lower() in ("true", "1") or os.environ.get("PYTEST_CURRENT_TEST") is not None

if is_testing:
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
    print(f"[DB] Using AsyncMongoMockClient for test environment.")
elif is_prod:
    client = AsyncIOMotorClient(mongo_url, **client_kwargs)
    print(f"[DB] Initialized AsyncIOMotorClient for {db_name}")
else:
    try:
        import pymongo
        sync_client = pymongo.MongoClient(mongo_url, serverSelectionTimeoutMS=2000, **client_kwargs)
        sync_client.admin.command('ping')
        client = AsyncIOMotorClient(mongo_url, **client_kwargs)
        print(f"[DB] Connected to MongoDB for {db_name}")
    except Exception as e:
        print(f"[DB] MongoDB unavailable ({e}). Using in-memory Mongo mock.")
        from mongomock_motor import AsyncMongoMockClient
        client = AsyncMongoMockClient()

db = client[db_name]


