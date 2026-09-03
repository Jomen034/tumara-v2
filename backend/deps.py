from dataclasses import dataclass
from fastapi import Depends

from db import db
from models import User, Household, now_utc
from auth import get_current_user

MIGRATE_COLLECTIONS = ["wallets", "transactions", "budgets", "goals",
                       "chat_messages", "networth_snapshots", "ai_recaps", "bills"]


@dataclass
class Ctx:
    user: User
    hid: str


async def ensure_household(user: User) -> str:
    if user.household_id:
        hh = await db.households.find_one({"id": user.household_id}, {"_id": 0})
        if hh:
            return user.household_id

    first = (user.name or "Keluarga").split()[0]
    hh = Household(name=f"Rumah {first}", owner_user_id=user.user_id)
    await db.households.insert_one(hh.model_dump())
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"household_id": hh.id, "role": "admin",
                  "display_name": user.display_name or user.name, "active": True}},
    )
    # Backfill any pre-existing single-user data into the new household.
    for coll in MIGRATE_COLLECTIONS:
        await db[coll].update_many(
            {"user_id": user.user_id, "household_id": {"$exists": False}},
            {"$set": {"household_id": hh.id}},
        )
    await db.transactions.update_many(
        {"user_id": user.user_id, "member_id": {"$exists": False}},
        {"$set": {"member_id": user.user_id}},
    )
    user.household_id = hh.id
    user.role = "admin"
    return hh.id


async def get_ctx(user: User = Depends(get_current_user)) -> Ctx:
    hid = await ensure_household(user)
    return Ctx(user=user, hid=hid)


async def household_members(hid: str):
    members = await db.users.find(
        {"household_id": hid, "active": {"$ne": False}}, {"_id": 0}
    ).to_list(10)
    return [{"user_id": m["user_id"], "name": m.get("display_name") or m["name"],
             "picture": m.get("picture"), "role": m.get("role", "partner"),
             "email": m.get("email")} for m in members]
