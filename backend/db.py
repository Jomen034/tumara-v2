import os
import certifi
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from mongomock_motor import AsyncMongoMockClient
from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "fincfo_db")

# Add certifi bundle if connecting via ssl/tls (mongodb+srv)
client_kwargs = {"serverSelectionTimeoutMS": 3000}
if "mongodb+srv" in mongo_url or "ssl=true" in mongo_url.lower() or "tls=true" in mongo_url.lower():
    client_kwargs["tlsCAFile"] = certifi.where()

# Test atlas connection synchronously
real_client = None
try:
    import pymongo
    sync_client = pymongo.MongoClient(mongo_url, **client_kwargs)
    sync_client.admin.command('ping')
    real_client = AsyncIOMotorClient(mongo_url, **client_kwargs)
    print("[DB] Connected successfully to MongoDB Atlas!")
except Exception as e:
    print(f"[DB] MongoDB Atlas connection unavailable ({e}). Using in-memory Mongo mock for local dev.")
    real_client = AsyncMongoMockClient()

client = real_client
db = client[db_name]


