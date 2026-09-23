import os
import secrets
import bcrypt
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr
import httpx

from db import db
from models import User, AccessCode, ForgotPasswordRequest, ResetPasswordRequest, now_utc, new_id

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "session_token"
SESSION_DAYS = 7
DEFAULT_ACCESS_CODE = "TUMARA2026"


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    access_code: Optional[str] = None
    invite_code: Optional[str] = None


class AccessCodeCreate(BaseModel):
    code: Optional[str] = None
    max_uses: int = 50
    note: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: Optional[str] = None
    credential: Optional[str] = None
    access_token: Optional[str] = None


async def _ensure_default_access_code():
    code = os.environ.get("REGISTRATION_CODE") or os.environ.get("ACCESS_CODE") or DEFAULT_ACCESS_CODE
    code_upper = code.strip().upper()
    existing = await db.access_codes.find_one({"code": code_upper})
    if not existing:
        await db.access_codes.insert_one({
            "id": new_id("ac"),
            "code": code_upper,
            "max_uses": 500,
            "used_count": 0,
            "active": True,
            "created_by": "system",
            "note": "Default alpha registration code",
            "created_at": now_utc(),
        })


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

    role = "admin"
    household_id = None
    onboarded = False

    invite_code = (body.invite_code or "").strip()
    access_code = (body.access_code or "").strip().upper()

    # 1. Option A: Registering as partner via Household Invite Code
    if invite_code:
        invite = await db.household_invites.find_one({"code": invite_code, "status": "pending"}, {"_id": 0})
        if not invite:
            raise HTTPException(status_code=400, detail="Kode undangan keluarga tidak valid atau sudah dipakai")
        from deps import household_members
        members = await household_members(invite["household_id"])
        if len(members) >= 2:
            raise HTTPException(status_code=400, detail="Rumah tangga keluarga sudah penuh (maksimal 2 anggota)")
        role = "partner"
        household_id = invite["household_id"]
        onboarded = True
        await db.household_invites.update_one(
            {"id": invite["id"]},
            {"$set": {"status": "accepted", "accepted_at": now_utc()}}
        )

    # 2. Option B: Registering as Admin via Access Code
    elif access_code:
        await _ensure_default_access_code()
        ac_record = await db.access_codes.find_one({"code": access_code, "active": True})
        if not ac_record:
            # Check if matching env code fallback
            default_code = (os.environ.get("REGISTRATION_CODE") or os.environ.get("ACCESS_CODE") or DEFAULT_ACCESS_CODE).strip().upper()
            if access_code == default_code:
                await _ensure_default_access_code()
                ac_record = await db.access_codes.find_one({"code": access_code, "active": True})

        if not ac_record:
            raise HTTPException(status_code=400, detail="Kode akses pendaftaran tidak valid")

        if ac_record.get("used_count", 0) >= ac_record.get("max_uses", 100):
            raise HTTPException(status_code=400, detail="Kuota pendaftaran untuk kode akses ini sudah habis")

        await db.access_codes.update_one(
            {"_id": ac_record["_id"]},
            {"$inc": {"used_count": 1}}
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="Kode akses pendaftaran (alpha code) atau kode undangan keluarga diperlukan untuk mendaftar"
        )

    hashed_pw = bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user_doc = {
        "user_id": new_id("user"),
        "email": email,
        "name": name,
        "picture": f"https://api.dicebear.com/7.x/notionists/svg?seed={email}",
        "password_hash": hashed_pw,
        "onboarded": onboarded,
        "household_id": household_id,
        "role": role,
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


# ---------------- Forgot & Reset Password ----------------
@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Format email tidak valid")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        # Return friendly message so we don't leak account existence
        return {
            "ok": True,
            "message": "Jika email terdaftar, instruksi pemulihan password telah dibuat.",
            "reset_token": None
        }

    token = f"rst_{secrets.token_urlsafe(16)}"
    expires_at = now_utc() + timedelta(minutes=30)

    # Invalidate previous unused tokens for this email
    await db.password_resets.update_many(
        {"email": email, "used": False},
        {"$set": {"used": True}}
    )

    await db.password_resets.insert_one({
        "id": new_id("rst"),
        "email": email,
        "token": token,
        "expires_at": expires_at,
        "used": False,
        "created_at": now_utc()
    })

    return {
        "ok": True,
        "message": "Kode pemulihan password berhasil dibuat. Masukkan kode ini bersama password baru.",
        "reset_token": token,
    }


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    token = (body.token or "").strip()
    new_pw = (body.new_password or "").strip()

    if not token:
        raise HTTPException(status_code=400, detail="Token pemulihan password wajib diisi")
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter")

    reset_rec = await db.password_resets.find_one({"token": token, "used": False})
    if not reset_rec:
        raise HTTPException(status_code=400, detail="Token pemulihan tidak valid atau sudah dipakai")

    expires_at = reset_rec.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not expires_at or expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token pemulihan sudah kadaluarsa")

    email = reset_rec["email"]
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Akun pengguna tidak ditemukan")

    hashed_pw = bcrypt.hashpw(new_pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    await db.users.update_one({"email": email}, {"$set": {"password_hash": hashed_pw}})
    await db.password_resets.update_one({"token": token}, {"$set": {"used": True, "used_at": now_utc()}})

    # Invalidate all active sessions for this user so they must log in with the new password
    await db.user_sessions.delete_many({"user_id": user["user_id"]})

    return {
        "ok": True,
        "message": "Password berhasil diperbarui! Silakan masuk dengan password baru Anda."
    }


# ---------------- Access Codes Management (Admin) ----------------
@router.get("/access-codes")
async def list_access_codes(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat melihat daftar kode akses")
    await _ensure_default_access_code()
    codes = await db.access_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return codes


@router.post("/access-codes")
async def create_access_code(body: AccessCodeCreate, user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat membuat kode akses baru")
    raw_code = body.code.strip().upper() if body.code else f"TUMARA-{secrets.token_hex(3).upper()}"
    existing = await db.access_codes.find_one({"code": raw_code})
    if existing:
        raise HTTPException(status_code=400, detail="Kode akses tersebut sudah ada")

    doc = {
        "id": new_id("ac"),
        "code": raw_code,
        "max_uses": body.max_uses,
        "used_count": 0,
        "active": True,
        "created_by": user.email,
        "note": body.note,
        "created_at": now_utc(),
    }
    await db.access_codes.insert_one(doc)
    doc.pop("_id", None)
    return doc


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

        # Ensure email is verified by Google if field is provided
        if id_info.get("email_verified") is False:
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
                if res.status_code != 200:
                    res = await hc.get("https://www.googleapis.com/oauth2/v3/userinfo", headers={"Authorization": f"Bearer {raw_token}"})

                if res.status_code == 200:
                    res_data = res.json()
                    # Check aud if client_id configured
                    if expected_client_id:
                        token_aud = res_data.get("aud") or res_data.get("azp")
                        if token_aud and token_aud != expected_client_id:
                            print(f"[Auth] Warning: audience mismatch {token_aud} != {expected_client_id}")

                    email_verified = res_data.get("email_verified")
                    if email_verified is None:
                        email_verified = res_data.get("verified_email")
                    if email_verified is False or email_verified == "false":
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

