import os
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
import bcrypt

from db import db
from models import User, new_id, now_utc
from auth import _create_user_session
from ai_quota import TIER_LIMITS, get_current_wib_month

router = APIRouter(prefix="/orders", tags=["orders"])

TIER_PRICES = {
    "starter": 49000,
    "pro": 99000,
    "family": 169000,
}

TIER_NAMES = {
    "starter": "Starter Personal",
    "pro": "Pro Tumara AI",
    "family": "Family Partner",
}

TIER_PREFIX = {
    "starter": "TMR-STR-",
    "pro": "TMR-PRO-",
    "family": "TMR-FAM-",
}


class CheckoutRequest(BaseModel):
    tier: Literal["starter", "pro", "family"]
    name: str
    email: str
    whatsapp: Optional[str] = None
    password: Optional[str] = None
    payment_method: Optional[str] = "qris"


class SimulatePaymentRequest(BaseModel):
    order_id: str


async def _generate_unique_access_code(tier: str, email: str, order_id: str, payment_method: str = "simulation") -> str:
    """Generate a clean, unique access code and persist it in db.access_codes."""
    prefix = TIER_PREFIX.get(tier, "TMR-PRO-")
    
    # Try up to 10 times to ensure absolute code uniqueness
    for _ in range(10):
        code_candidate = f"{prefix}{secrets.token_hex(3).upper()}"
        existing = await db.access_codes.find_one({"code": code_candidate})
        if not existing:
            doc = {
                "id": new_id("ac"),
                "code": code_candidate,
                "max_uses": 1,
                "used_count": 0,
                "active": True,
                "tier": tier,
                "created_by": "system_checkout",
                "buyer_email": email.strip().lower(),
                "order_id": order_id,
                "note": f"Lisensi {TIER_NAMES.get(tier, tier)} via {payment_method}",
                "created_at": now_utc(),
            }
            await db.access_codes.insert_one(doc)
            return code_candidate
            
    raise HTTPException(status_code=500, detail="Gagal membuat kode lisensi unik. Silakan coba lagi.")


async def _auto_register_buyer(name: str, email: str, password: str, tier: str, access_code: str, response: Response, request: Request):
    """Auto-register buyer upon successful payment and create user session."""
    clean_email = email.strip().lower()
    existing = await db.users.find_one({"email": clean_email})
    if existing:
        return {"already_registered": True, "user": None, "session_token": None}

    user_tier = tier
    from deps import new_household_id
    household_id = new_household_id()
    
    limits = TIER_LIMITS.get(user_tier, TIER_LIMITS["pro"])
    ai_usage = {
        "month": get_current_wib_month(),
        "scans_used": 0,
        "chats_used": 0,
        "tier": user_tier,
        "scans_limit": limits["scans"],
        "chats_limit": limits["chats"],
    }

    hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user_doc = {
        "user_id": new_id("user"),
        "email": clean_email,
        "name": name.strip(),
        "picture": f"https://api.dicebear.com/7.x/notionists/svg?seed={clean_email}",
        "password_hash": hashed_pw,
        "onboarded": False,
        "household_id": household_id,
        "role": "admin",
        "tier": user_tier,
        "display_name": name.strip(),
        "active": True,
        "ai_usage": ai_usage,
        "created_at": now_utc(),
    }
    await db.users.insert_one(user_doc)
    
    # Mark the access code as used
    await db.access_codes.update_one(
        {"code": access_code},
        {"$inc": {"used_count": 1}}
    )

    user = User(**user_doc)
    session_result = await _create_user_session(user, response, request)
    return {
        "already_registered": False,
        "user": session_result["user"],
        "session_token": session_result["session_token"],
    }


@router.post("/checkout")
async def checkout(body: CheckoutRequest, request: Request):
    clean_email = body.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Alamat email tidak valid")
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Nama lengkap wajib diisi")

    tier = body.tier
    amount = TIER_PRICES[tier]
    order_id = f"TMR-{tier[:3].upper()}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}-{secrets.token_hex(2).upper()}"
    
    midtrans_server_key = os.environ.get("MIDTRANS_SERVER_KEY", "").strip()
    mode = "midtrans" if midtrans_server_key else "simulation"
    snap_token = None
    snap_redirect_url = None

    # If Midtrans is configured, try creating a Snap transaction
    if mode == "midtrans":
        try:
            import httpx
            import base64
            auth_header = "Basic " + base64.b64encode(f"{midtrans_server_key}:".encode()).decode()
            snap_endpoint = "https://app.midtrans.com/snap/v1/transactions"
            if os.environ.get("MIDTRANS_IS_SANDBOX", "false").lower() in ("true", "1"):
                snap_endpoint = "https://app.sandbox.midtrans.com/snap/v1/transactions"
                
            async with httpx.AsyncClient(timeout=10.0) as client:
                snap_res = await client.post(
                    snap_endpoint,
                    headers={"Authorization": auth_header, "Content-Type": "application/json"},
                    json={
                        "transaction_details": {"order_id": order_id, "gross_amount": amount},
                        "customer_details": {
                            "first_name": body.name.strip(),
                            "email": clean_email,
                            "phone": body.whatsapp or "",
                        },
                        "item_details": [{
                            "id": tier,
                            "price": amount,
                            "quantity": 1,
                            "name": f"Tumara {TIER_NAMES[tier]} (Lifetime)"
                        }]
                    }
                )
                if snap_res.status_code in (200, 201):
                    snap_data = snap_res.json()
                    snap_token = snap_data.get("token")
                    snap_redirect_url = snap_data.get("redirect_url")
        except Exception as e:
            print(f"[Checkout] Midtrans request notice: {e}, falling back to simulation mode")
            mode = "simulation"

    order_doc = {
        "order_id": order_id,
        "tier": tier,
        "tier_name": TIER_NAMES[tier],
        "amount": amount,
        "name": body.name.strip(),
        "email": clean_email,
        "whatsapp": body.whatsapp.strip() if body.whatsapp else None,
        "password": body.password if body.password else None,
        "payment_method": body.payment_method or "qris",
        "status": "pending",
        "mode": mode,
        "snap_token": snap_token,
        "snap_redirect_url": snap_redirect_url,
        "access_code": None,
        "created_at": now_utc(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
    }
    await db.orders.insert_one(order_doc)

    simulation_data = None
    if mode == "simulation":
        simulation_data = {
            "qris_code": f"00020101021226670016ID.CO.TUMARA.WWW011893600911{secrets.token_hex(4).upper()}5204581253033605802ID5914TUMARA FINANCE6007JAKARTA6304{secrets.token_hex(2).upper()}",
            "va_number": f"88708{secrets.token_hex(4).upper()}",
            "va_bank": "BCA / Mandiri / BRI Virtual Account",
            "countdown_seconds": 86400,
        }

    return {
        "order_id": order_id,
        "tier": tier,
        "tier_name": TIER_NAMES[tier],
        "amount": amount,
        "name": body.name.strip(),
        "email": clean_email,
        "mode": mode,
        "snap_token": snap_token,
        "snap_redirect_url": snap_redirect_url,
        "simulation": simulation_data,
        "status": "pending",
    }


@router.post("/simulate-pay")
async def simulate_payment(body: SimulatePaymentRequest, response: Response, request: Request):
    """Instant payment simulation endpoint for testing the complete funnel without real money."""
    order = await db.orders.find_one({"order_id": body.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order pesanan tidak ditemukan")

    if order.get("status") == "paid":
        # Order already paid, return existing access code
        existing_code = order.get("access_code")
        return {
            "status": "paid",
            "order_id": order["order_id"],
            "tier": order["tier"],
            "tier_name": order.get("tier_name", TIER_NAMES.get(order["tier"], order["tier"])),
            "access_code": existing_code,
            "message": "Pesanan ini sudah berhasil dibayar sebelumnya.",
            "auto_login": False,
        }

    # 1. Generate unique access code
    access_code = await _generate_unique_access_code(
        tier=order["tier"],
        email=order["email"],
        order_id=order["order_id"],
        payment_method="simulation"
    )

    # 2. Update order to paid
    await db.orders.update_one(
        {"order_id": order["order_id"]},
        {"$set": {
            "status": "paid",
            "access_code": access_code,
            "paid_at": now_utc(),
        }}
    )

    # 3. Check if password was provided during checkout for seamless auto-registration
    auto_login_data = None
    if order.get("password") and len(order["password"]) >= 6:
        auto_login_data = await _auto_register_buyer(
            name=order["name"],
            email=order["email"],
            password=order["password"],
            tier=order["tier"],
            access_code=access_code,
            response=response,
            request=request
        )

    return {
        "status": "paid",
        "order_id": order["order_id"],
        "tier": order["tier"],
        "tier_name": order.get("tier_name", TIER_NAMES.get(order["tier"], order["tier"])),
        "amount": order["amount"],
        "access_code": access_code,
        "auto_login": bool(auto_login_data and not auto_login_data.get("already_registered")),
        "already_registered": bool(auto_login_data and auto_login_data.get("already_registered")),
        "user": auto_login_data.get("user") if auto_login_data else None,
        "session_token": auto_login_data.get("session_token") if auto_login_data else None,
        "message": "Pembayaran berhasil dikonfirmasi! Kode lisensi aktif seumur hidup.",
    }


@router.get("/{order_id}/status")
async def get_order_status(order_id: str):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0, "password": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order pesanan tidak ditemukan")
    return {
        "order_id": order["order_id"],
        "tier": order["tier"],
        "tier_name": order.get("tier_name", TIER_NAMES.get(order["tier"], order["tier"])),
        "amount": order["amount"],
        "status": order["status"],
        "access_code": order.get("access_code"),
        "mode": order.get("mode", "simulation"),
        "created_at": order.get("created_at"),
        "paid_at": order.get("paid_at"),
    }


@router.post("/webhook/midtrans")
async def midtrans_webhook(request: Request, response: Response):
    """Official Midtrans Webhook Handler for automated payment confirmation."""
    midtrans_server_key = os.environ.get("MIDTRANS_SERVER_KEY", "").strip()
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    order_id = body.get("order_id")
    status_code = body.get("status_code")
    gross_amount = body.get("gross_amount")
    signature_key = body.get("signature_key")
    transaction_status = body.get("transaction_status")
    fraud_status = body.get("fraud_status", "accept")

    # Verify signature if key is set
    if midtrans_server_key and signature_key:
        raw_str = f"{order_id}{status_code}{gross_amount}{midtrans_server_key}"
        expected_sig = hashlib.sha512(raw_str.encode("utf-8")).hexdigest()
        if expected_sig != signature_key:
            raise HTTPException(status_code=400, detail="Invalid signature key")

    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        return {"status": "ignored", "reason": "order_not_found"}

    if transaction_status in ("capture", "settlement") and fraud_status in ("accept", ""):
        if order.get("status") != "paid":
            access_code = await _generate_unique_access_code(
                tier=order["tier"],
                email=order["email"],
                order_id=order_id,
                payment_method=body.get("payment_type", "midtrans")
            )
            await db.orders.update_one(
                {"order_id": order_id},
                {"$set": {
                    "status": "paid",
                    "access_code": access_code,
                    "paid_at": now_utc(),
                    "payment_meta": body,
                }}
            )
            # Auto register if password is saved
            if order.get("password") and len(order["password"]) >= 6:
                await _auto_register_buyer(
                    name=order["name"],
                    email=order["email"],
                    password=order["password"],
                    tier=order["tier"],
                    access_code=access_code,
                    response=response,
                    request=request
                )

    elif transaction_status in ("deny", "cancel", "expire"):
        await db.orders.update_one(
            {"order_id": order_id},
            {"$set": {"status": "failed", "failed_at": now_utc(), "payment_meta": body}}
        )

    return {"status": "ok"}
