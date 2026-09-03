from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db import db
from models import User, ChatRequest, now_utc, new_id
from auth import get_current_user
from deps import get_ctx, Ctx
from ai_service import advisor_stream, scan_receipt, parse_transaction_text, generate_weekly_recap

router = APIRouter(prefix="/ai", tags=["ai"])


class ParseRequest(BaseModel):
    text: str


@router.get("/chat/history")
async def chat_history(user: User = Depends(get_current_user)):
    msgs = await db.chat_messages.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return msgs


@router.delete("/chat/history")
async def clear_history(user: User = Depends(get_current_user)):
    await db.chat_messages.delete_many({"user_id": user.user_id})
    return {"ok": True}


@router.post("/chat")
async def chat(body: ChatRequest, ctx: Ctx = Depends(get_ctx)):
    user = ctx.user
    session_id = f"advisor_{user.user_id}"
    user_msg = {
        "id": new_id("msg"), "user_id": user.user_id, "role": "user",
        "content": body.message, "created_at": now_utc(),
    }
    await db.chat_messages.insert_one(dict(user_msg))

    async def gen():
        full = ""
        try:
            async for token in advisor_stream(ctx.hid, session_id, body.message, []):
                full += token
                yield token
        except Exception as e:
            err = f"\n\n⚠️ Maaf, terjadi kendala: {str(e)[:120]}"
            full += err
            yield err
        finally:
            await db.chat_messages.insert_one({
                "id": new_id("msg"), "user_id": user.user_id, "role": "assistant",
                "content": full, "created_at": now_utc(),
            })

    return StreamingResponse(
        gen(), media_type="text/plain",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/scan-receipt")
async def scan_receipt_endpoint(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/jpg"):
        raise HTTPException(400, "Format gambar harus JPEG, PNG, atau WEBP")
    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(400, "File kosong")
    try:
        data = await scan_receipt(raw)
    except Exception as e:
        raise HTTPException(500, f"Gagal memindai struk: {str(e)[:120]}")
    return data



@router.post("/parse-transaction")
async def parse_transaction_endpoint(body: ParseRequest, ctx: Ctx = Depends(get_ctx)):
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Teks kosong")
    wallets = await db.wallets.find({"household_id": ctx.hid}, {"_id": 0}).to_list(200)
    try:
        draft = await parse_transaction_text(text, wallets)
    except Exception as e:
        raise HTTPException(500, f"Gagal memahami teks: {str(e)[:120]}")
    return draft


@router.get("/weekly-recap")
async def weekly_recap(refresh: bool = False, ctx: Ctx = Depends(get_ctx)):
    hid = ctx.hid
    week = datetime.now(timezone.utc).strftime("%G-W%V")
    if not refresh:
        cached = await db.ai_recaps.find_one({"household_id": hid, "week": week}, {"_id": 0})
        if cached:
            return {"content": cached["content"], "week": week, "cached": True}
    try:
        content = await generate_weekly_recap(hid)
    except Exception as e:
        raise HTTPException(500, f"Gagal membuat rangkuman: {str(e)[:120]}")
    await db.ai_recaps.update_one(
        {"household_id": hid, "week": week},
        {"$set": {"household_id": hid, "week": week, "content": content, "created_at": now_utc()}},
        upsert=True,
    )
    return {"content": content, "week": week, "cached": False}
