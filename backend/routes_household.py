import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from db import db
from models import User, InviteCreate, JoinRequest, HouseholdUpdate, MAX_HOUSEHOLD_MEMBERS, now_utc, new_id
from auth import get_current_user
from deps import get_ctx, Ctx, ensure_household, household_members

router = APIRouter(prefix="/household", tags=["household"])


@router.get("")
async def get_household(ctx: Ctx = Depends(get_ctx)):
    hh = await db.households.find_one({"id": ctx.hid}, {"_id": 0})
    members = await household_members(ctx.hid)
    invites = await db.household_invites.find(
        {"household_id": ctx.hid, "status": "pending"}, {"_id": 0}
    ).to_list(10)

    # Calculate current month's spending and income per member
    now = datetime.now(timezone.utc)
    month_start = f"{now.year:04d}-{now.month:02d}-01"

    tx_cursor = db.transactions.find({
        "household_id": ctx.hid,
        "date": {"$gte": month_start}
    }, {"_id": 0, "id": 1, "member_id": 1, "type": 1, "amount": 1, "category": 1, "note": 1, "date": 1, "created_at": 1}).sort("date", -1)

    monthly_txs = await tx_cursor.to_list(200)

    member_stats = {m["user_id"]: {"total_spent": 0.0, "total_income": 0.0, "tx_count": 0} for m in members}
    total_hh_spent = 0.0
    total_hh_income = 0.0

    for tx in monthly_txs:
        mid = tx.get("member_id")
        amt = float(tx.get("amount") or 0.0)
        ttype = tx.get("type")
        if mid in member_stats:
            member_stats[mid]["tx_count"] += 1
            if ttype == "expense":
                member_stats[mid]["total_spent"] += amt
                total_hh_spent += amt
            elif ttype == "income":
                member_stats[mid]["total_income"] += amt
                total_hh_income += amt

    # Enrich members with stats
    enriched_members = []
    for m in members:
        uid = m["user_id"]
        stats = member_stats.get(uid, {"total_spent": 0.0, "total_income": 0.0, "tx_count": 0})
        spent = stats["total_spent"]
        pct = round((spent / total_hh_spent * 100), 1) if total_hh_spent > 0 else 0.0
        enriched_members.append({
            **m,
            "total_spent": spent,
            "total_income": stats["total_income"],
            "tx_count": stats["tx_count"],
            "spent_percentage": pct
        })

    # Recent activity items (top 8 across all months for quick feed)
    recent_cursor = db.transactions.find(
        {"household_id": ctx.hid},
        {"_id": 0, "id": 1, "member_id": 1, "type": 1, "amount": 1, "category": 1, "note": 1, "date": 1, "created_at": 1}
    ).sort("created_at", -1)
    recent_txs = await recent_cursor.to_list(8)

    return {
        "household": hh,
        "members": enriched_members,
        "invites": invites,
        "role": ctx.user.role,
        "max_members": MAX_HOUSEHOLD_MEMBERS,
        "can_invite": ctx.user.role == "admin" and len(members) < MAX_HOUSEHOLD_MEMBERS,
        "analytics": {
            "total_spent": total_hh_spent,
            "total_income": total_hh_income,
            "period": f"{now.year:04d}-{now.month:02d}",
        },
        "activity_feed": recent_txs
    }


@router.put("")
async def update_household(body: HouseholdUpdate, ctx: Ctx = Depends(get_ctx)):
    if ctx.user.role != "admin":
        raise HTTPException(403, "Hanya admin yang bisa mengubah informasi rumah tangga")
    updates = {}
    if body.name is not None and body.name.strip():
        updates["name"] = body.name.strip()
    if body.emoji_icon is not None and body.emoji_icon.strip():
        updates["emoji_icon"] = body.emoji_icon.strip()
    
    if updates:
        await db.households.update_one({"id": ctx.hid}, {"$set": updates})
    
    hh = await db.households.find_one({"id": ctx.hid}, {"_id": 0})
    return hh


@router.post("/leave")
async def leave_household(user: User = Depends(get_current_user)):
    if not user.household_id:
        raise HTTPException(400, "Kamu tidak terdaftar di rumah tangga mana pun")
    if user.role == "admin":
        members = await household_members(user.household_id)
        if len(members) > 1:
            raise HTTPException(400, "Admin tidak bisa keluar jika masih ada anggota lain. Silakan keluarkan partner terlebih dahulu.")
        raise HTTPException(400, "Sebagai pemilik tunggal, kamu tidak bisa keluar dari rumah tangga sendiri.")

    # Partner leaves voluntarily
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"household_id": None, "role": "admin", "onboarded": True}}
    )
    # Ensure they have their own independent household
    await ensure_household(user.user_id)
    return {"ok": True, "message": "Berhasil keluar dari rumah tangga"}


@router.post("/invite")
async def create_invite(body: InviteCreate, ctx: Ctx = Depends(get_ctx)):
    if ctx.user.role != "admin":
        raise HTTPException(403, "Hanya admin yang bisa mengundang")
    members = await household_members(ctx.hid)
    if len(members) >= MAX_HOUSEHOLD_MEMBERS:
        raise HTTPException(400, f"Rumah tangga sudah penuh (maks {MAX_HOUSEHOLD_MEMBERS} anggota)")
    # reuse an existing pending invite if any
    existing = await db.household_invites.find_one(
        {"household_id": ctx.hid, "status": "pending"}, {"_id": 0}
    )
    if existing:
        return existing
    code = secrets.token_urlsafe(6)
    invite = {"id": new_id("inv"), "household_id": ctx.hid, "code": code,
              "email": body.email, "created_by": ctx.user.user_id,
              "status": "pending", "created_at": now_utc()}
    await db.household_invites.insert_one(dict(invite))
    invite.pop("_id", None)
    return invite


@router.post("/join")
async def join_household(body: JoinRequest, user: User = Depends(get_current_user)):
    code = (body.code or "").strip()
    invite = await db.household_invites.find_one({"code": code, "status": "pending"}, {"_id": 0})
    if not invite:
        raise HTTPException(404, "Kode undangan tidak valid atau sudah dipakai")
    hid = invite["household_id"]
    members = await household_members(hid)
    if len(members) >= MAX_HOUSEHOLD_MEMBERS:
        raise HTTPException(400, "Rumah tangga sudah penuh")
    if any(m["user_id"] == user.user_id for m in members):
        raise HTTPException(400, "Kamu sudah menjadi anggota")
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"household_id": hid, "role": "partner",
                  "display_name": user.name, "active": True, "onboarded": True}},
    )
    await db.household_invites.update_one(
        {"id": invite["id"]}, {"$set": {"status": "accepted", "accepted_by": user.user_id}}
    )
    hh = await db.households.find_one({"id": hid}, {"_id": 0})
    return {"ok": True, "household": hh}


@router.delete("/invite/{invite_id}")
async def revoke_invite(invite_id: str, ctx: Ctx = Depends(get_ctx)):
    if ctx.user.role != "admin":
        raise HTTPException(403, "Hanya admin")
    await db.household_invites.delete_one({"id": invite_id, "household_id": ctx.hid})
    return {"ok": True}


@router.delete("/members/{member_user_id}")
async def remove_member(member_user_id: str, ctx: Ctx = Depends(get_ctx)):
    if ctx.user.role != "admin":
        raise HTTPException(403, "Hanya admin yang bisa mengeluarkan anggota")
    if member_user_id == ctx.user.user_id:
        raise HTTPException(400, "Admin tidak bisa keluar dari rumah tangga sendiri")
    # move member to their own fresh household (data attribution stays intact)
    member = await db.users.find_one({"user_id": member_user_id, "household_id": ctx.hid}, {"_id": 0})
    if not member:
        raise HTTPException(404, "Anggota tidak ditemukan")
    await db.users.update_one(
        {"user_id": member_user_id},
        {"$set": {"household_id": None, "role": "admin", "onboarded": True}},
    )
    await ensure_household(member_user_id)
    return {"ok": True}
