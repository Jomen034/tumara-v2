"""Backend API tests for Nusa Personal AI Finance CFO."""
import io
import os
import time
import pytest
import requests
from PIL import Image

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://1acc03c7-b948-45f2-bdc6-c2c36a3cbc26.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
TOKEN = "test_session_cfo_001"
H = {"Authorization": f"Bearer {TOKEN}"}


# ---------- Auth ----------
def test_me_unauthenticated():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_me_authenticated():
    r = requests.get(f"{API}/auth/me", headers=H)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["email"] == "test.cfo@example.com"
    assert "user_id" in d


# ---------- Wallets CRUD ----------
@pytest.fixture(scope="module")
def wallet_ids():
    ids = {}
    # Clean-slate: delete existing test wallets by listing them (not filtering user)
    for name, wtype, bal in [("TEST_BCA", "bank", 5000000), ("TEST_Gopay", "ewallet", 500000)]:
        r = requests.post(f"{API}/wallets", headers=H, json={"name": name, "type": wtype, "balance": bal})
        assert r.status_code == 200, r.text
        ids[name] = r.json()["id"]
    yield ids
    for wid in ids.values():
        requests.delete(f"{API}/wallets/{wid}", headers=H)


def test_wallets_list(wallet_ids):
    r = requests.get(f"{API}/wallets", headers=H)
    assert r.status_code == 200
    names = [w["name"] for w in r.json()]
    assert "TEST_BCA" in names and "TEST_Gopay" in names


def test_wallet_update(wallet_ids):
    wid = wallet_ids["TEST_BCA"]
    r = requests.put(f"{API}/wallets/{wid}", headers=H, json={"name": "TEST_BCA", "type": "bank", "balance": 6000000})
    assert r.status_code == 200
    assert r.json()["balance"] == 6000000


# ---------- Transactions ----------
def test_expense_decreases_balance(wallet_ids):
    wid = wallet_ids["TEST_Gopay"]
    before = next(w for w in requests.get(f"{API}/wallets", headers=H).json() if w["id"] == wid)["balance"]
    r = requests.post(f"{API}/transactions", headers=H, json={
        "type": "expense", "amount": 25000, "wallet_id": wid,
        "category": "Makanan & Minuman", "note": "TEST_lunch"
    })
    assert r.status_code == 200, r.text
    txn_id = r.json()["id"]
    after = next(w for w in requests.get(f"{API}/wallets", headers=H).json() if w["id"] == wid)["balance"]
    assert after == before - 25000

    # delete reverts
    dr = requests.delete(f"{API}/transactions/{txn_id}", headers=H)
    assert dr.status_code == 200
    reverted = next(w for w in requests.get(f"{API}/wallets", headers=H).json() if w["id"] == wid)["balance"]
    assert reverted == before


def test_income_increases_balance(wallet_ids):
    wid = wallet_ids["TEST_BCA"]
    before = next(w for w in requests.get(f"{API}/wallets", headers=H).json() if w["id"] == wid)["balance"]
    r = requests.post(f"{API}/transactions", headers=H, json={
        "type": "income", "amount": 1000000, "wallet_id": wid, "category": "Gaji", "note": "TEST_salary"
    })
    assert r.status_code == 200
    after = next(w for w in requests.get(f"{API}/wallets", headers=H).json() if w["id"] == wid)["balance"]
    assert after == before + 1000000
    requests.delete(f"{API}/transactions/{r.json()['id']}", headers=H)


def test_transfer_moves_balance(wallet_ids):
    src, dst = wallet_ids["TEST_BCA"], wallet_ids["TEST_Gopay"]
    wallets = {w["id"]: w["balance"] for w in requests.get(f"{API}/wallets", headers=H).json()}
    r = requests.post(f"{API}/transactions", headers=H, json={
        "type": "transfer", "amount": 100000, "wallet_id": src, "to_wallet_id": dst, "category": "Lainnya"
    })
    assert r.status_code == 200
    after = {w["id"]: w["balance"] for w in requests.get(f"{API}/wallets", headers=H).json()}
    assert after[src] == wallets[src] - 100000
    assert after[dst] == wallets[dst] + 100000
    requests.delete(f"{API}/transactions/{r.json()['id']}", headers=H)


# ---------- Budget ----------
def test_budget_create_and_get():
    payload = {
        "monthly_income": 10000000, "mode": "percentage",
        "categories": [
            {"category": "Makanan & Minuman", "limit": 3000000, "group": "needs"},
            {"category": "Hiburan", "limit": 1000000, "group": "wants"},
        ],
    }
    r = requests.post(f"{API}/budget", headers=H, json=payload)
    assert r.status_code == 200, r.text
    g = requests.get(f"{API}/budget", headers=H)
    assert g.status_code == 200
    d = g.json()
    assert d["monthly_income"] == 10000000
    assert len(d["categories"]) == 2
    # user marked onboarded
    me = requests.get(f"{API}/auth/me", headers=H).json()
    assert me["onboarded"] is True


# ---------- Goals ----------
def test_goals_flow():
    r = requests.post(f"{API}/goals", headers=H, json={
        "title": "TEST_Emergency Fund", "target_amount": 5000000, "saved_amount": 0, "emoji": "💰"
    })
    assert r.status_code == 200
    gid = r.json()["id"]
    dep = requests.post(f"{API}/goals/{gid}/deposit", headers=H, json={"amount": 250000})
    assert dep.status_code == 200
    assert dep.json()["saved_amount"] == 250000
    dl = requests.delete(f"{API}/goals/{gid}", headers=H)
    assert dl.status_code == 200


# ---------- Dashboard & Analytics ----------
def test_dashboard():
    r = requests.get(f"{API}/dashboard", headers=H)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("net_worth", "assets", "debt", "income", "expense", "health_score",
              "budget_status", "recent_transactions", "wallets", "goals"):
        assert k in d
    assert 0 <= d["health_score"] <= 100


def test_analytics():
    r = requests.get(f"{API}/analytics", headers=H)
    assert r.status_code == 200
    d = r.json()
    assert "trend" in d and "category_breakdown" in d
    assert isinstance(d["trend"], list)


# ---------- AI ----------
def test_ai_chat_stream_and_history():
    # Clear first
    requests.delete(f"{API}/ai/chat/history", headers=H)
    r = requests.post(f"{API}/ai/chat", headers=H, json={"message": "Halo, ringkas kondisi keuangan saya dalam 1 kalimat."}, stream=True, timeout=60)
    assert r.status_code == 200, r.text
    chunks = []
    for chunk in r.iter_content(chunk_size=None):
        if chunk:
            chunks.append(chunk.decode("utf-8", errors="ignore"))
    full = "".join(chunks)
    assert len(full.strip()) > 0
    time.sleep(1)
    hist = requests.get(f"{API}/ai/chat/history", headers=H)
    assert hist.status_code == 200
    msgs = hist.json()
    assert len(msgs) >= 2
    roles = [m["role"] for m in msgs]
    assert "user" in roles and "assistant" in roles
    # Clean up
    requests.delete(f"{API}/ai/chat/history", headers=H)


def test_ai_scan_receipt():
    # Build a synthetic receipt-like image
    img = Image.new("RGB", (600, 800), "white")
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    text = "TOKO MAKMUR\n2026-01-05\nNasi Goreng   25.000\nEs Teh         5.000\nTotal         30.000"
    d.text((30, 30), text, fill="black")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    r = requests.post(f"{API}/ai/scan-receipt", headers=H, files={"file": ("r.jpg", buf.getvalue(), "image/jpeg")}, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("merchant", "total", "date", "category", "items"):
        assert k in data
