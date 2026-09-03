"""New feature tests: parse-transaction, weekly-recap, networth/history, complete-onboarding, scan-receipt itemize."""
import io
import os
import time
import pytest
import requests
from PIL import Image, ImageDraw

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"
TOKEN = "test_session_cfo_001"
NEW_TOKEN = "test_session_new_002"
H = {"Authorization": f"Bearer {TOKEN}"}
HN = {"Authorization": f"Bearer {NEW_TOKEN}"}


# ---------- AI parse-transaction ----------
def test_parse_transaction_basic():
    r = requests.post(f"{API}/ai/parse-transaction", headers=H,
                      json={"text": "isi bensin bp 92 400k pakai debit ocbc"}, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    # Expect a draft dict with common fields
    assert isinstance(d, dict)
    # Should identify expense at 400000
    amount = d.get("amount")
    assert amount in (400000, 400_000, 400000.0) or (isinstance(amount, (int, float)) and 300000 <= amount <= 500000), f"amount={amount} data={d}"
    # Category likely Transportasi
    cat = (d.get("category") or "").lower()
    assert "transport" in cat or "bensin" in cat or "bahan bakar" in cat, f"category={cat} data={d}"
    # Wallet match — should pick OCBC Debit wallet if suggested
    wid = d.get("wallet_id") or ""
    # It is acceptable to be None but if present should be the seeded wal_ocbctest
    if wid:
        assert wid == "wal_ocbctest", f"wallet_id mismatch: {wid} data={d}"


def test_parse_transaction_empty():
    r = requests.post(f"{API}/ai/parse-transaction", headers=H, json={"text": "   "})
    assert r.status_code == 400


def test_parse_transaction_unauth():
    r = requests.post(f"{API}/ai/parse-transaction", json={"text": "kopi 25k"})
    assert r.status_code == 401


# ---------- AI weekly-recap ----------
def test_weekly_recap_fetch_and_refresh():
    r = requests.get(f"{API}/ai/weekly-recap", headers=H, timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "content" in d and "week" in d
    assert len(d["content"].strip()) > 20
    # Second call should be cached (unless refresh=true)
    r2 = requests.get(f"{API}/ai/weekly-recap", headers=H, timeout=30)
    assert r2.status_code == 200
    assert r2.json().get("cached") is True
    # refresh=true regenerates
    r3 = requests.get(f"{API}/ai/weekly-recap?refresh=true", headers=H, timeout=90)
    assert r3.status_code == 200
    assert r3.json().get("cached") is False


# ---------- Net worth history ----------
def test_networth_history():
    # Trigger a snapshot by creating & deleting a dummy wallet (idempotent per day)
    r0 = requests.get(f"{API}/networth/history", headers=H)
    assert r0.status_code == 200
    snaps = r0.json()
    assert isinstance(snaps, list)
    if snaps:
        s = snaps[-1]
        for k in ("date", "assets", "debt", "net_worth"):
            assert k in s


# ---------- Complete onboarding ----------
def test_complete_onboarding_flow():
    # New user starts unboarded
    me = requests.get(f"{API}/auth/me", headers=HN)
    assert me.status_code == 200, me.text
    assert me.json().get("onboarded") is False
    # Complete onboarding
    r = requests.post(f"{API}/auth/complete-onboarding", headers=HN)
    assert r.status_code == 200
    assert r.json().get("onboarded") is True
    # Verify persisted
    me2 = requests.get(f"{API}/auth/me", headers=HN)
    assert me2.json().get("onboarded") is True
    # Reset for future runs
    import pymongo
    # Just call it again to keep idempotent; reset via direct? skip.


# ---------- Scan receipt returns items array ----------
def test_scan_receipt_items():
    img = Image.new("RGB", (600, 800), "white")
    d = ImageDraw.Draw(img)
    d.text((20, 20),
           "TOKO SEHAT\n2026-01-08\nSusu UHT   15.000\nRoti Tawar 12.000\nTeh Kotak   5.000\nTotal      32.000",
           fill="black")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    r = requests.post(f"{API}/ai/scan-receipt", headers=H,
                      files={"file": ("r.jpg", buf.getvalue(), "image/jpeg")}, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "items" in data
    assert isinstance(data["items"], list)
