import secrets
from fastapi import APIRouter, Depends, HTTPException

from db import db
from models import User, InviteCreate, JoinRequest, MAX_HOUSEHOLD_MEMBERS, now_utc, new_id
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
    return {"household": hh, "members": members, "invites": invites,
            "role": ctx.user.role, "max_members": MAX_HOUSEHOLD_MEMBERS,
            "can_invite": ctx.user.role == "admin" and len(members) < MAX_HOUSEHOLD_MEMBERS}


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
        {"$set": {"household_id": None, "role": "admin", "onboarded": False}},
    )
    return {"ok": True}
