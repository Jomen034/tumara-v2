import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, Response, HTTPException, Depends
import httpx

from db import db
from models import User, now_utc

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_DATA_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
COOKIE_NAME = "session_token"
SESSION_DAYS = 7


async def get_current_user(request: Request) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


@router.post("/session")
async def create_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        try:
            body = await request.json()
            session_id = body.get("session_id")
        except Exception:
            session_id = None
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")

    async with httpx.AsyncClient(timeout=20) as hc:
        r = await hc.get(SESSION_DATA_URL, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to verify session")
    data = r.json()

    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        user = User(**existing)
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {"name": data["name"], "picture": data.get("picture")}},
        )
    else:
        from models import new_id
        user = User(
            user_id=new_id("user"), email=data["email"],
            name=data["name"], picture=data.get("picture"),
        )
        await db.users.insert_one(user.model_dump())

    session_token = data["session_token"]
    expires_at = now_utc() + timedelta(days=SESSION_DAYS)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {"user_id": user.user_id, "session_token": session_token,
                  "expires_at": expires_at, "created_at": now_utc()}},
        upsert=True,
    )

    response.set_cookie(
        key=COOKIE_NAME, value=session_token, httponly=True, secure=True,
        samesite="none", path="/", max_age=SESSION_DAYS * 24 * 60 * 60,
    )
    from deps import ensure_household
    fresh = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    await ensure_household(User(**fresh))
    user = User(**await db.users.find_one({"user_id": user.user_id}, {"_id": 0}))
    return {"user": user.model_dump(), "session_token": session_token}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return user.model_dump()


@router.post("/complete-onboarding")
async def complete_onboarding(user: User = Depends(get_current_user)):
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"onboarded": True}})
    user.onboarded = True
    return user.model_dump()


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}
