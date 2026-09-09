import os
import secrets
import bcrypt
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr
import httpx

from db import db
from models import User, now_utc, new_id

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "session_token"
SESSION_DAYS = 7


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: Optional[str] = None
    credential: Optional[str] = None
    access_token: Optional[str] = None


def _set_session_cookie(response: Response, session_token: str, request: Optional[Request] = None):
    env = os.environ.get("ENVIRONMENT", "").lower()
    is_prod = env in ("production", "prod", "true", "1") or (request and request.url.scheme == "https")
    response.set_cookie(
        key=COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        path="/",
        max_age=SESSION_DAYS * 24 * 60 * 60,
    )


async def _create_user_session(user: User, response: Response) -> dict:
    session_token = f"sess_{secrets.token_hex(20)}"
    expires_at = now_utc() + timedelta(days=SESSION_DAYS)
    
    await db.user_sessions.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "user_id": user.user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": now_utc(),
        }},
        upsert=True,
    )

    _set_session_cookie(response, session_token)
    from deps import ensure_household
    fresh = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    await ensure_household(User(**fresh))
    user_data = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    # Remove sensitive password hash from user response
    user_data.pop("password_hash", None)
    return {"user": user_data, "session_token": session_token}


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
    user_doc.pop("password_hash", None)
    return User(**user_doc)


@router.post("/register")
async def register(body: RegisterRequest, response: Response):
    email = body.email.strip().lower()
    name = body.name.strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Email tidak valid")
    if not name:
        raise HTTPException(status_code=400, detail="Nama wajib diisi")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password minimal 6 karakter")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar. Silakan masuk.")

    hashed_pw = bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user_doc = {
        "user_id": new_id("user"),
        "email": email,
        "name": name,
        "picture": f"https://api.dicebear.com/7.x/notionists/svg?seed={email}",
        "password_hash": hashed_pw,
        "onboarded": False,
        "household_id": None,
        "role": "admin",
        "display_name": name,
        "active": True,
        "created_at": now_utc(),
    }
    await db.users.insert_one(user_doc)
    user = User(**user_doc)
    return await _create_user_session(user, response)


@router.post("/login")
async def login(body: LoginRequest, response: Response):
    email = body.email.strip().lower()
    existing = await db.users.find_one({"email": email})
    if not existing or "password_hash" not in existing:
        raise HTTPException(status_code=401, detail="Email atau password salah")

    if not bcrypt.checkpw(body.password.encode("utf-8"), existing["password_hash"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Email atau password salah")

    existing.pop("_id", None)
    existing.pop("password_hash", None)
    user = User(**existing)
    return await _create_user_session(user, response)


@router.post("/google")
async def google_auth(body: GoogleAuthRequest, response: Response):
    """Verify Google OAuth id_token directly with Google APIs."""
    token = (body.id_token or body.credential or body.access_token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token Google tidak ditemukan")

    data = None
    last_err = None

    # 1. Try verification with google-auth library
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        id_info = google_id_token.verify_oauth2_token(
            token, google_requests.Request(), clock_skew_in_seconds=10
        )
        if id_info and id_info.get("email"):
            data = {
                "email": id_info["email"],
                "name": id_info.get("name") or id_info.get("given_name") or "Pengguna Tumara",
                "picture": id_info.get("picture"),
            }
    except Exception as exc:
        last_err = str(exc)
        print(f"[Auth] google.oauth2 verify fallback: {exc}")

    # 2. Fallback HTTP tokeninfo verification
    if not data or not data.get("email"):
        try:
            async with httpx.AsyncClient(timeout=12) as hc:
                res = await hc.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={token}")
                if res.status_code != 200:
                    res = await hc.get(f"https://www.googleapis.com/oauth2/v3/tokeninfo?id_token={token}")
                if res.status_code != 200:
                    res = await hc.get("https://www.googleapis.com/oauth2/v3/userinfo", headers={"Authorization": f"Bearer {token}"})

                if res.status_code == 200:
                    res_data = res.json()
                    data = {
                        "email": res_data.get("email"),
                        "name": res_data.get("name") or res_data.get("given_name") or "Pengguna Tumara",
                        "picture": res_data.get("picture"),
                    }
                else:
                    last_err = f"Google endpoint returned {res.status_code}: {res.text[:100]}"
        except Exception as exc:
            last_err = str(exc)
            print(f"[Auth] httpx tokeninfo verify fallback error: {exc}")

    if not data or not data.get("email"):
        detail_msg = f"Gagal verifikasi akun Google: {last_err}" if last_err else "Gagal verifikasi akun Google"
        raise HTTPException(status_code=401, detail=detail_msg)

    email = data["email"].strip().lower()
    name = data["name"]
    picture = data.get("picture")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        existing.pop("password_hash", None)
        user = User(**existing)
        if picture or name:
            await db.users.update_one({"user_id": user.user_id}, {"$set": {"picture": picture, "name": name}})
    else:
        user_doc = {
            "user_id": new_id("user"),
            "email": email,
            "name": name,
            "picture": picture or f"https://api.dicebear.com/7.x/notionists/svg?seed={email}",
            "onboarded": False,
            "household_id": None,
            "role": "admin",
            "display_name": name,
            "active": True,
            "created_at": now_utc(),
        }
        await db.users.insert_one(user_doc)
        user = User(**user_doc)

    return await _create_user_session(user, response)


@router.post("/dev-login")
async def dev_login(request: Request, response: Response):
    """Local / Standalone development demo mode."""
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    email = body.get("email", "local.user@example.com")
    name = body.get("name", "Local CFO")
    picture = body.get("picture", "https://api.dicebear.com/7.x/notionists/svg?seed=cfo")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user = User(**existing)
    else:
        user_doc = {
            "user_id": new_id("user"),
            "email": email,
            "name": name,
            "picture": picture,
            "onboarded": False,
            "household_id": None,
            "role": "admin",
            "display_name": name,
            "active": True,
            "created_at": now_utc(),
        }
        await db.users.insert_one(user_doc)
        user = User(**user_doc)

    return await _create_user_session(user, response)


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    user_dict = user.model_dump()
    user_dict.pop("password_hash", None)
    return user_dict


@router.post("/complete-onboarding")
async def complete_onboarding(user: User = Depends(get_current_user)):
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"onboarded": True}})
    user.onboarded = True
    user_dict = user.model_dump()
    user_dict.pop("password_hash", None)
    return user_dict


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

