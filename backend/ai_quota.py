"""AI Quota and Fair Usage Policy (FUP) Management for Tumara.

Handles monthly usage reset, tier limits, anti-abuse safeguards, and code redemption.
"""
from datetime import datetime, timezone, timedelta
try:
    from fastapi import HTTPException
except ImportError:
    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: any = None):
            self.status_code = status_code
            self.detail = detail

try:
    from db import db
except ImportError:
    db = None

TIER_LIMITS = {
    "starter": {"scans": 10, "chats": 20},
    "pro": {"scans": 60, "chats": 150},
    "family": {"scans": 150, "chats": 300},
}

ID_MONTHS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]


def get_current_wib_month() -> str:
    wib_now = datetime.now(timezone(timedelta(hours=7)))
    return wib_now.strftime("%Y-%m")


def get_next_reset_date() -> str:
    wib_now = datetime.now(timezone(timedelta(hours=7)))
    if wib_now.month == 12:
        next_month = 1
        next_year = wib_now.year + 1
    else:
        next_month = wib_now.month + 1
        next_year = wib_now.year
    return f"1 {ID_MONTHS[next_month - 1]} {next_year}"


async def get_or_init_ai_usage(user_id: str, tier: str = "pro") -> dict:
    current_month = get_current_wib_month()
    user_doc = await db.users.find_one({"user_id": user_id})
    if not user_doc:
        raise HTTPException(404, "Pengguna tidak ditemukan")

    user_tier = user_doc.get("tier") or tier or "pro"
    limits = TIER_LIMITS.get(user_tier, TIER_LIMITS["pro"])

    ai_usage = user_doc.get("ai_usage") or {}
    last_month = ai_usage.get("month")

    # Extra/booster balances never expire across months
    extra_scans = int(ai_usage.get("extra_scans", 0) or 0)
    extra_chats = int(ai_usage.get("extra_chats", 0) or 0)

    # Auto reset monthly quota on month change
    if last_month != current_month:
        ai_usage = {
            "month": current_month,
            "scans_used": 0,
            "chats_used": 0,
            "extra_scans": extra_scans,
            "extra_chats": extra_chats,
            "tier": user_tier,
            "scans_limit": limits["scans"],
            "chats_limit": limits["chats"],
        }
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"ai_usage": ai_usage, "tier": user_tier}}
        )
    else:
        # Ensure limits and extra balances are present
        updated = False
        if "scans_limit" not in ai_usage or ai_usage.get("scans_limit") != limits["scans"]:
            ai_usage["scans_limit"] = limits["scans"]
            ai_usage["chats_limit"] = limits["chats"]
            ai_usage["tier"] = user_tier
            updated = True
        if "extra_scans" not in ai_usage:
            ai_usage["extra_scans"] = extra_scans
            ai_usage["extra_chats"] = extra_chats
            updated = True
        if updated:
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"ai_usage": ai_usage}}
            )

    return ai_usage


async def enforce_and_increment_ai_quota(user_id: str, action: str):
    """
    Checks quota for action ('scan' or 'chat').
    Prioritizes monthly regular quota first.
    If monthly quota is exceeded, uses non-expiring extra_scans/extra_chats booster.
    If both are exhausted, raises HTTPException(429) with structured payload.
    """
    user_doc = await db.users.find_one({"user_id": user_id})
    tier = (user_doc or {}).get("tier", "pro")
    usage = await get_or_init_ai_usage(user_id, tier)
    reset_date = get_next_reset_date()

    if action == "scan":
        used = usage.get("scans_used", 0)
        limit = usage.get("scans_limit", 50)
        extra = int(usage.get("extra_scans", 0) or 0)

        if used < limit:
            await db.users.update_one(
                {"user_id": user_id},
                {"$inc": {"ai_usage.scans_used": 1}}
            )
        elif extra > 0:
            await db.users.update_one(
                {"user_id": user_id},
                {"$inc": {"ai_usage.extra_scans": -1}}
            )
        else:
            raise HTTPException(
                status_code=429,
                detail={
                    "message": f"Kuota AI scan struk bulan ini telah mencapai batas FUP ({used}/{limit}).",
                    "quota_exceeded": True,
                    "action": "scan",
                    "scans_used": used,
                    "scans_limit": limit,
                    "extra_scans": 0,
                    "reset_date": reset_date,
                    "tier": usage.get("tier", "pro"),
                    "can_upgrade": True,
                }
            )
    elif action == "chat":
        used = usage.get("chats_used", 0)
        limit = usage.get("chats_limit", 100)
        extra = int(usage.get("extra_chats", 0) or 0)

        if used < limit:
            await db.users.update_one(
                {"user_id": user_id},
                {"$inc": {"ai_usage.chats_used": 1}}
            )
        elif extra > 0:
            await db.users.update_one(
                {"user_id": user_id},
                {"$inc": {"ai_usage.extra_chats": -1}}
            )
        else:
            raise HTTPException(
                status_code=429,
                detail={
                    "message": f"Kuota AI teks & konsultasi bulan ini telah mencapai batas FUP ({used}/{limit}).",
                    "quota_exceeded": True,
                    "action": "chat",
                    "chats_used": used,
                    "chats_limit": limit,
                    "extra_chats": 0,
                    "reset_date": reset_date,
                    "tier": usage.get("tier", "pro"),
                    "can_upgrade": True,
                }
            )
