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


def _is_secure_request(request: Optional[Request] = None) -> bool:
    env = os.environ.get("ENVIRONMENT", "").lower()
    is_prod_env = env in ("production", "prod", "true", "1")
    if is_prod_env:
        return True
    if request:
        if request.url.scheme == "https":
            return True
        if request.headers.get("x-forwarded-proto") == "https":
            return True
    return False


def _set_session_cookie(response: Response, session_token: str, request: Optional[Request] = None):
    is_secure = _is_secure_request(request)
    response.set_cookie(
        key=COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=is_secure,
        samesite="none" if is_secure else "lax",
        path="/",
        max_age=SESSION_DAYS * 24 * 60 * 60,
    )


def _clear_session_cookie(response: Response, request: Optional[Request] = None):
    is_secure = _is_secure_request(request)
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=is_secure,
        samesite="none" if is_secure else "lax",
        httponly=True,
    )


async def _create_user_session(user: User, response: Response, request: Optional[Request] = None) -> dict:
    session_token = f"sess_{secrets.token_hex(24)}"
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

    _set_session_cookie(response, session_token, request)
    from deps import ensure_household
    fresh = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if fresh:
        await ensure_household(User(**fresh))
    user_data = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    # Remove sensitive password hash from user response
    if user_data:
        user_data.pop("password_hash", None)
    return {"user": user_data, "session_token": session_token}


async def get_current_user(request: Request) -> User:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:].strip()

    if not token:
        token = request.cookies.get(COOKIE_NAME)

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session and auth.startswith("Bearer "):
        cookie_token = request.cookies.get(COOKIE_NAME)
        if cookie_token and cookie_token != token:
            session = await db.user_sessions.find_one({"session_token": cookie_token}, {"_id": 0})
            if session:
                token = cookie_token

    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        try:
            expires_at = datetime.fromisoformat(expires_at)
        except Exception:
            expires_at = None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not expires_at or expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": token})
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    if not user_doc.get("active", True):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    user_doc.pop("password_hash", None)
    return User(**user_doc)


@router.post("/register")
async def register(body: RegisterRequest, request: Request, response: Response):
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
    return await _create_user_session(user, response, request)


@router.post("/login")
async def login(body: LoginRequest, request: Request, response: Response):
    email = body.email.strip().lower()
    existing = await db.users.find_one({"email": email})
    if not existing or "password_hash" not in existing:
        raise HTTPException(status_code=401, detail="Email atau password salah")

    if not existing.get("active", True):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")

    if not bcrypt.checkpw(body.password.encode("utf-8"), existing["password_hash"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Email atau password salah")

    existing.pop("_id", None)
    existing.pop("password_hash", None)
    user = User(**existing)
    return await _create_user_session(user, response, request)


@router.post("/google")
async def google_auth(body: GoogleAuthRequest, request: Request, response: Response):
    """Verify Google OAuth id_token directly with Google APIs."""
    raw_token = (body.id_token or body.credential or body.access_token or "").strip()
    if not raw_token:
        raise HTTPException(status_code=400, detail="Token Google tidak ditemukan")

    expected_client_id = os.environ.get("GOOGLE_CLIENT_ID") or os.environ.get("REACT_APP_GOOGLE_CLIENT_ID")

    data = None
    last_err = None

    # 1. Try verification with official google-auth library
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        id_info = google_id_token.verify_oauth2_token(
            raw_token,
            google_requests.Request(),
            audience=expected_client_id if expected_client_id else None,
            clock_skew_in_seconds=10,
        )
        iss = id_info.get("iss", "")
        if iss not in ("accounts.google.com", "https://accounts.google.com"):
            raise ValueError(f"Invalid issuer: {iss}")

        # Ensure email is verified by Google
        if not id_info.get("email_verified", False):
            raise ValueError("Google email is not verified")

        if id_info.get("email"):
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
                res = await hc.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={raw_token}")
                if res.status_code != 200:
                    res = await hc.get(f"https://www.googleapis.com/oauth2/v3/tokeninfo?id_token={raw_token}")
                if res.status_code != 200 and body.access_token:
                    res = await hc.get("https://www.googleapis.com/oauth2/v3/userinfo", headers={"Authorization": f"Bearer {raw_token}"})

                if res.status_code == 200:
                    res_data = res.json()
                    # Check aud if client_id configured
                    if expected_client_id:
                        token_aud = res_data.get("aud") or res_data.get("azp")
                        if token_aud and token_aud != expected_client_id:
                            raise ValueError(f"Audience mismatch: {token_aud} != {expected_client_id}")

                    email_verified = res_data.get("email_verified")
                    if email_verified not in (True, "true", "True", 1):
                        raise ValueError("Email not verified by Google")

                    if res_data.get("email"):
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
        if not existing.get("active", True):
            raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
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

    return await _create_user_session(user, response, request)


@router.post("/dev-login")
async def dev_login(request: Request, response: Response):
    """Local / Standalone development demo mode. Disabled in production."""
    env = os.environ.get("ENVIRONMENT", "").lower()
    is_prod = env in ("production", "prod", "true", "1")
    allow_dev = os.environ.get("ALLOW_DEV_LOGIN", "").lower() in ("true", "1")
    if is_prod and not allow_dev:
        raise HTTPException(status_code=403, detail="Dev login tidak tersedia di lingkungan produksi")

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
        if not existing.get("active", True):
            raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
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

    return await _create_user_session(user, response, request)


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
            token = auth[7:].strip()
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    _clear_session_cookie(response, request)
    return {"ok": True}

