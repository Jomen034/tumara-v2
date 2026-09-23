"""Comprehensive security and authentication test suite for Nusa (Tumara v2)."""
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from httpx import AsyncClient, ASGITransport

from server import app
from db import db
from models import now_utc, new_id


@pytest.fixture(autouse=True)
async def clean_test_db():
    # Setup / cleanup before tests
    yield
    # No-op or cleanup if needed


@pytest.mark.asyncio
async def test_register_and_login_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        email = f"user_{datetime.now().timestamp()}@example.com"
        
        # 1. Attempt register without code -> 400
        r_no_code = await ac.post("/api/auth/register", json={
            "name": "Budi Tanpa Kode",
            "email": email,
            "password": "secretpassword123"
        })
        assert r_no_code.status_code == 400

        # 2. Attempt register with invalid access code -> 400
        r_bad_code = await ac.post("/api/auth/register", json={
            "name": "Budi Kode Salah",
            "email": email,
            "password": "secretpassword123",
            "access_code": "INVALID_CODE_999"
        })
        assert r_bad_code.status_code == 400

        # 3. Register valid user with access code (Admin)
        r_reg = await ac.post("/api/auth/register", json={
            "name": "Budi Santoso",
            "email": email,
            "password": "secretpassword123",
            "access_code": "TUMARA2026"
        })
        assert r_reg.status_code == 200
        data = r_reg.json()
        assert "user" in data
        assert data["user"]["email"] == email
        assert data["user"]["role"] == "admin"
        assert "password_hash" not in data["user"]
        assert "session_token" in r_reg.cookies

        # 4. Login with correct password
        r_login = await ac.post("/api/auth/login", json={
            "email": email,
            "password": "secretpassword123"
        })
        assert r_login.status_code == 200
        assert "session_token" in r_login.cookies
        assert "password_hash" not in r_login.json()["user"]

        # 5. Login with wrong password
        r_bad_pw = await ac.post("/api/auth/login", json={
            "email": email,
            "password": "wrongpassword"
        })
        assert r_bad_pw.status_code == 401

        # 6. Login with non-existent email
        r_bad_email = await ac.post("/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "secretpassword123"
        })
        assert r_bad_email.status_code == 401


@pytest.mark.asyncio
async def test_partner_registration_via_invite_code():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        admin_email = f"admin_{datetime.now().timestamp()}@example.com"
        partner_email = f"partner_{datetime.now().timestamp()}@example.com"

        # 1. Admin registers
        r_admin = await ac.post("/api/auth/register", json={
            "name": "Admin Keluarga",
            "email": admin_email,
            "password": "password123",
            "access_code": "TUMARA2026"
        })
        assert r_admin.status_code == 200
        admin_sess = r_admin.cookies.get("session_token")

        # 2. Admin creates household invite
        r_inv = await ac.post("/api/household/invite", cookies={"session_token": admin_sess}, json={})
        assert r_inv.status_code == 200
        invite_code = r_inv.json()["code"]

        # 3. Partner registers directly with invite_code
        r_partner = await ac.post("/api/auth/register", json={
            "name": "Pasangan Tercinta",
            "email": partner_email,
            "password": "password123",
            "invite_code": invite_code
        })
        assert r_partner.status_code == 200
        partner_data = r_partner.json()["user"]
        assert partner_data["role"] == "partner"
        assert partner_data["household_id"] == r_admin.json()["user"]["household_id"]

        # 4. Attempt to register 3rd member with same invite -> 400 (already accepted/full)
        r_third = await ac.post("/api/auth/register", json={
            "name": "Member Ketiga",
            "email": f"third_{datetime.now().timestamp()}@example.com",
            "password": "password123",
            "invite_code": invite_code
        })
        assert r_third.status_code == 400


@pytest.mark.asyncio
async def test_forgot_and_reset_password_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        email = f"reset_test_{datetime.now().timestamp()}@example.com"
        # 1. Register user
        reg = await ac.post("/api/auth/register", json={
            "name": "Reset Test User",
            "email": email,
            "password": "oldpassword123",
            "access_code": "TUMARA2026"
        })
        assert reg.status_code == 200

        # 2. Request forgot password
        fp = await ac.post("/api/auth/forgot-password", json={"email": email})
        assert fp.status_code == 200
        token = fp.json().get("reset_token")
        assert token and token.startswith("rst_")

        # 3. Reset password with invalid token -> 400
        r_bad_tok = await ac.post("/api/auth/reset-password", json={
            "token": "rst_invalid_fake_token",
            "new_password": "brandnewpassword123"
        })
        assert r_bad_tok.status_code == 400

        # 4. Reset password with valid token
        r_good_reset = await ac.post("/api/auth/reset-password", json={
            "token": token,
            "new_password": "brandnewpassword123"
        })
        assert r_good_reset.status_code == 200

        # 5. Old password should fail
        r_old_login = await ac.post("/api/auth/login", json={
            "email": email,
            "password": "oldpassword123"
        })
        assert r_old_login.status_code == 401

        # 6. New password should succeed
        r_new_login = await ac.post("/api/auth/login", json={
            "email": email,
            "password": "brandnewpassword123"
        })
        assert r_new_login.status_code == 200

        # 7. Token reuse should fail -> 400
        r_reuse = await ac.post("/api/auth/reset-password", json={
            "token": token,
            "new_password": "anotherpassword123"
        })
        assert r_reuse.status_code == 400


@pytest.mark.asyncio
async def test_unauthenticated_and_invalid_sessions():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. No auth provided -> 401
        r_no_auth = await ac.get("/api/auth/me")
        assert r_no_auth.status_code == 401

        r_dash = await ac.get("/api/dashboard")
        assert r_dash.status_code == 401

        r_wallets = await ac.get("/api/wallets")
        assert r_wallets.status_code == 401

        # 2. Invalid session token -> 401
        r_inv = await ac.get("/api/auth/me", cookies={"session_token": "sess_invalid_token_123"})
        assert r_inv.status_code == 401

        r_inv_hdr = await ac.get("/api/auth/me", headers={"Authorization": "Bearer sess_invalid_token_123"})
        assert r_inv_hdr.status_code == 401


@pytest.mark.asyncio
async def test_session_expiration():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create user & expired session in db
        user_id = f"user_exp_{datetime.now().timestamp()}"
        sess_token = f"sess_expired_{datetime.now().timestamp()}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": "expired@example.com",
            "name": "Expired User",
            "active": True,
            "role": "admin",
            "created_at": now_utc()
        })
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": sess_token,
            "expires_at": now_utc() - timedelta(days=1),
            "created_at": now_utc() - timedelta(days=8)
        })

        # Request with expired session -> 401
        r = await ac.get("/api/auth/me", cookies={"session_token": sess_token})
        assert r.status_code == 401
        assert "expired" in r.json().get("detail", "").lower()

        # Check that expired session was purged from db
        in_db = await db.user_sessions.find_one({"session_token": sess_token})
        assert in_db is None


@pytest.mark.asyncio
async def test_logout_invalidation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Register user
        email = f"logout_{datetime.now().timestamp()}@example.com"
        reg = await ac.post("/api/auth/register", json={
            "name": "Logout Test",
            "email": email,
            "password": "password123",
            "access_code": "TUMARA2026"
        })
        assert reg.status_code == 200
        token = reg.cookies.get("session_token")
        assert token

        # Verify authenticated
        me = await ac.get("/api/auth/me")
        assert me.status_code == 200

        # Logout
        lo = await ac.post("/api/auth/logout")
        assert lo.status_code == 200

        # Session in DB should be deleted
        in_db = await db.user_sessions.find_one({"session_token": token})
        assert in_db is None

        # Subsequent call with old session -> 401
        me_after = await ac.get("/api/auth/me", cookies={"session_token": token})
        assert me_after.status_code == 401


@pytest.mark.asyncio
async def test_inactive_user_blocked():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        user_id = f"user_inact_{datetime.now().timestamp()}"
        sess_token = f"sess_inact_{datetime.now().timestamp()}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": "inactive@example.com",
            "name": "Inactive User",
            "active": False,
            "role": "admin",
            "created_at": now_utc()
        })
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": sess_token,
            "expires_at": now_utc() + timedelta(days=7),
            "created_at": now_utc()
        })

        r = await ac.get("/api/auth/me", cookies={"session_token": sess_token})
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_dev_login_blocked_in_production():
    transport = ASGITransport(app=app)
    with patch.dict(os.environ, {"ENVIRONMENT": "production", "ALLOW_DEV_LOGIN": "false"}):
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            r = await ac.post("/api/auth/dev-login", json={"email": "hacker@example.com"})
            assert r.status_code == 403
            assert "lingkungan produksi" in r.json().get("detail", "").lower()

    # Dev login works when not in production
    with patch.dict(os.environ, {"ENVIRONMENT": "development", "ALLOW_DEV_LOGIN": "true"}):
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            r = await ac.post("/api/auth/dev-login", json={"email": "dev.test@example.com"})
            assert r.status_code == 200
            assert "session_token" in r.cookies


@pytest.mark.asyncio
async def test_admin_db_stats_access_control():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Unauthenticated -> 401
        r_unauth = await ac.get("/api/admin/db-stats")
        assert r_unauth.status_code == 401

        # 2. Partner (non-admin) -> 403
        partner_uid = f"user_partner_{datetime.now().timestamp()}"
        partner_sess = f"sess_partner_{datetime.now().timestamp()}"
        await db.users.insert_one({
            "user_id": partner_uid,
            "email": "partner@example.com",
            "name": "Partner User",
            "active": True,
            "role": "partner",
            "created_at": now_utc()
        })
        await db.user_sessions.insert_one({
            "user_id": partner_uid,
            "session_token": partner_sess,
            "expires_at": now_utc() + timedelta(days=7),
            "created_at": now_utc()
        })
        r_partner = await ac.get("/api/admin/db-stats", cookies={"session_token": partner_sess})
        assert r_partner.status_code == 403

        # 3. Admin in production without ALLOW_ADMIN_STATS -> 403
        admin_uid = f"user_admin_{datetime.now().timestamp()}"
        admin_sess = f"sess_admin_{datetime.now().timestamp()}"
        await db.users.insert_one({
            "user_id": admin_uid,
            "email": "admin@example.com",
            "name": "Admin User",
            "active": True,
            "role": "admin",
            "created_at": now_utc()
        })
        await db.user_sessions.insert_one({
            "user_id": admin_uid,
            "session_token": admin_sess,
            "expires_at": now_utc() + timedelta(days=7),
            "created_at": now_utc()
        })

        with patch.dict(os.environ, {"ENVIRONMENT": "production", "ALLOW_ADMIN_STATS": "false"}):
            r_admin_prod = await ac.get("/api/admin/db-stats", cookies={"session_token": admin_sess})
            assert r_admin_prod.status_code == 403

        # 4. Admin in development -> 200
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            r_admin_dev = await ac.get("/api/admin/db-stats", cookies={"session_token": admin_sess})
            assert r_admin_dev.status_code == 200
            assert "collections" in r_admin_dev.json()


@pytest.mark.asyncio
async def test_google_auth_validation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Missing token -> 400
        r_empty = await ac.post("/api/auth/google", json={})
        assert r_empty.status_code == 400

        # 2. Fake token fails verification -> 401
        r_fake = await ac.post("/api/auth/google", json={"id_token": "invalid_fake_jwt_token"})
        assert r_fake.status_code == 401

        # 3. Successful verified Google token
        mock_payload = {
            "iss": "accounts.google.com",
            "email": "google.verified@example.com",
            "email_verified": True,
            "name": "Google Verified User",
            "picture": "https://example.com/pic.jpg"
        }
        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=mock_payload):
            r_good = await ac.post("/api/auth/google", json={"id_token": "mocked_valid_token"})
            assert r_good.status_code == 200
            assert "session_token" in r_good.cookies
            data = r_good.json()
            assert data["user"]["email"] == "google.verified@example.com"

        # 4. Unverified email from Google token is rejected -> 401
        mock_unverified = {
            "iss": "accounts.google.com",
            "email": "unverified@example.com",
            "email_verified": False,
            "name": "Unverified User"
        }
        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=mock_unverified):
            r_unver = await ac.post("/api/auth/google", json={"id_token": "mocked_unverified_token"})
            assert r_unver.status_code == 401


@pytest.mark.asyncio
async def test_household_isolation_and_idor_prevention():
    transport = ASGITransport(app=app)
    
    # Client A for User A
    async with AsyncClient(transport=transport, base_url="http://test") as client_a:
        reg_a = await client_a.post("/api/auth/register", json={
            "name": "User A",
            "email": f"user_a_{datetime.now().timestamp()}@example.com",
            "password": "passwordA123",
            "access_code": "TUMARA2026"
        })
        assert reg_a.status_code == 200

        # User A creates a wallet
        r_w_a = await client_a.post("/api/wallets", json={
            "name": "Dompet Rahasia A", "type": "bank", "balance": 10000000
        })
        assert r_w_a.status_code == 200
        wallet_a_id = r_w_a.json()["id"]

        # User A creates a Goal
        r_g_a = await client_a.post("/api/goals", json={
            "title": "Beli Rumah A", "target_amount": 500000000
        })
        assert r_g_a.status_code == 200
        goal_a_id = r_g_a.json()["id"]

        # User A creates a Bill
        r_b_a = await client_a.post("/api/bills", json={
            "name": "Listrik A", "amount": 250000, "next_due_date": "2026-10-01", "recurrence": "monthly"
        })
        assert r_b_a.status_code == 200
        bill_a_id = r_b_a.json()["id"]

    # Client B for User B (completely separate cookie jar and session)
    async with AsyncClient(transport=transport, base_url="http://test") as client_b:
        reg_b = await client_b.post("/api/auth/register", json={
            "name": "User B",
            "email": f"user_b_{datetime.now().timestamp()}@example.com",
            "password": "passwordB123",
            "access_code": "TUMARA2026"
        })
        assert reg_b.status_code == 200

        # User B lists wallets -> Should NOT see User A's wallet
        r_w_b = await client_b.get("/api/wallets")
        assert r_w_b.status_code == 200
        b_wallet_ids = [w["id"] for w in r_w_b.json()]
        assert wallet_a_id not in b_wallet_ids

        # User B attempts IDOR on User A's wallet (PUT) -> 404
        r_idor_put = await client_b.put(f"/api/wallets/{wallet_a_id}", json={
            "name": "Hacked Wallet", "type": "bank", "balance": 0
        })
        assert r_idor_put.status_code == 404

        # User B attempts IDOR delete on User A's wallet -> 404
        r_idor_del = await client_b.delete(f"/api/wallets/{wallet_a_id}")
        assert r_idor_del.status_code == 404

        # User B attempts IDOR deposit or delete on User A's Goal -> 404
        r_idor_goal_dep = await client_b.post(f"/api/goals/{goal_a_id}/deposit", json={
            "amount": 100000
        })
        assert r_idor_goal_dep.status_code == 404

        r_idor_goal_del = await client_b.delete(f"/api/goals/{goal_a_id}")
        assert r_idor_goal_del.status_code == 404

        # User B attempts IDOR update, pay, delete on User A's Bill -> 404
        r_idor_bill_put = await client_b.put(f"/api/bills/{bill_a_id}", json={
            "name": "Hacked Bill", "amount": 1, "next_due_date": "2026-10-01", "recurrence": "monthly"
        })
        assert r_idor_bill_put.status_code == 404

        r_idor_bill_pay = await client_b.post(f"/api/bills/{bill_a_id}/pay")
        assert r_idor_bill_pay.status_code == 404

        r_idor_bill_del = await client_b.delete(f"/api/bills/{bill_a_id}")
        assert r_idor_bill_del.status_code == 404
