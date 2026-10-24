from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db import db
from models import User, ChatRequest, now_utc, new_id
from auth import get_current_user
from deps import get_ctx, Ctx
from ai_service import advisor_stream, scan_receipt, parse_transaction_text, generate_weekly_recap
from ai_quota import enforce_and_increment_ai_quota, get_or_init_ai_usage, get_next_reset_date

router = APIRouter(prefix="/ai", tags=["ai"])


class ParseRequest(BaseModel):
    text: str


@router.get("/usage")
async def get_ai_usage_endpoint(user: User = Depends(get_current_user)):
    """Returns monthly AI quota usage, limits, tier, and next reset date."""
    usage = await get_or_init_ai_usage(user.user_id, getattr(user, "tier", "pro"))
    usage["reset_date"] = get_next_reset_date()
    return usage


@router.get("/chat/history")
async def chat_history(user: User = Depends(get_current_user)):
    # Ephemeral session: Chat history is not permanently persisted on database
    return []


@router.delete("/chat/history")
async def clear_history(user: User = Depends(get_current_user)):
    # Clean up any legacy chat records for this user
    await db.chat_messages.delete_many({"user_id": user.user_id})
    return {"ok": True}


@router.post("/chat")
async def chat(body: ChatRequest, ctx: Ctx = Depends(get_ctx)):
    user = ctx.user
    # Enforce AI chat quota (FUP)
    await enforce_and_increment_ai_quota(user.user_id, "chat")

    # Capture user prompt for product analytics & security audit (response is NOT stored)
    prompt_text = (body.message or "").strip()
    if prompt_text:
        try:
            await db.ai_prompt_logs.insert_one({
                "prompt_id": new_id("prm"),
                "user_id": user.user_id,
                "household_id": ctx.hid,
                "prompt": prompt_text,
                "char_count": len(prompt_text),
                "source": "advisor_chat",
                "created_at": now_utc(),
            })
        except Exception as log_err:
            print(f"[AI Prompt Log] Non-critical error recording prompt: {log_err}")

    session_id = f"advisor_{user.user_id}"

    async def gen():
        try:
            async for token in advisor_stream(ctx.hid, session_id, body.message, body.history or []):
                yield token
        except Exception as e:
            err = f"\n\n⚠️ Maaf, terjadi kendala: {str(e)[:120]}"
            yield err

    return StreamingResponse(
        gen(), media_type="text/plain",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/scan-receipt")
async def scan_receipt_endpoint(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    try:
        raw = await file.read()
        if len(raw) == 0:
            raise HTTPException(400, "File kosong")
        ct = (file.content_type or "").lower()
        allowed_types = ("image/jpeg", "image/png", "image/webp", "image/jpg", "image/heic", "image/heif", "application/octet-stream")
        if ct and not (ct.startswith("image/") or ct in allowed_types):
            raise HTTPException(400, f"Format gambar harus gambar valid (diterima: {ct})")

        # Enforce AI scan quota (FUP)
        await enforce_and_increment_ai_quota(user.user_id, "scan")

        data = await scan_receipt(raw)
        return data
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(422, f"Gagal memindai struk: {str(e)[:200]}")



@router.post("/parse-transaction")
async def parse_transaction_endpoint(body: ParseRequest, ctx: Ctx = Depends(get_ctx)):
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Teks kosong")
    
    # Enforce AI text quota (FUP)
    await enforce_and_increment_ai_quota(ctx.user.user_id, "chat")

    wallets = await db.wallets.find({"household_id": ctx.hid}, {"_id": 0}).to_list(200)
    bills = await db.bills.find({"household_id": ctx.hid, "is_completed": {"$ne": True}}, {"_id": 0}).to_list(100)
    try:
        draft = await parse_transaction_text(text, wallets, bills)
    except Exception as e:
        raise HTTPException(500, f"Gagal memahami teks: {str(e)[:120]}")
    return draft


@router.get("/weekly-recap")
async def weekly_recap(refresh: bool = False, ctx: Ctx = Depends(get_ctx)):
    hid = ctx.hid
    week = datetime.now(timezone.utc).strftime("%G-W%V")
    user_tier = getattr(ctx.user, "tier", "pro")

    # Weekly AI Recap is exclusive to Pro and Family tiers
    if user_tier == "starter":
        return {
            "locked": True,
            "tier": "starter",
            "message": "Weekly AI Financial Health Recap eksklusif untuk pengguna paket Pro & Family Partner. Silakan upgrade akunmu untuk menikmati evaluasi naratif mingguan otomatis.",
            "content": None,
            "week": week,
            "cached": True,
        }

    if not refresh:
        cached = await db.ai_recaps.find_one({"household_id": hid, "week": week}, {"_id": 0})
        if cached:
            return {"content": cached["content"], "week": week, "cached": True, "locked": False}
    try:
        content = await generate_weekly_recap(hid)
    except Exception as e:
        raise HTTPException(500, f"Gagal membuat rangkuman: {str(e)[:120]}")
    await db.ai_recaps.update_one(
        {"household_id": hid, "week": week},
        {"$set": {"household_id": hid, "week": week, "content": content, "created_at": now_utc()}},
        upsert=True,
    )
    return {"content": content, "week": week, "cached": False, "locked": False}
