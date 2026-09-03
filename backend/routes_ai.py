from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse

from db import db
from models import User, ChatRequest, now_utc, new_id
from auth import get_current_user
from ai_service import advisor_stream, scan_receipt

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/chat/history")
async def chat_history(user: User = Depends(get_current_user)):
    msgs = await db.chat_messages.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return msgs


@router.delete("/chat/history")
async def clear_history(user: User = Depends(get_current_user)):
    await db.chat_messages.delete_many({"user_id": user.user_id})
    return {"ok": True}


@router.post("/chat")
async def chat(body: ChatRequest, user: User = Depends(get_current_user)):
    session_id = f"advisor_{user.user_id}"
    user_msg = {
        "id": new_id("msg"), "user_id": user.user_id, "role": "user",
        "content": body.message, "created_at": now_utc(),
    }
    await db.chat_messages.insert_one(dict(user_msg))

    async def gen():
        full = ""
        try:
            async for token in advisor_stream(user.user_id, session_id, body.message, []):
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
