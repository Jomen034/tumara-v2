"""Round 3 feature tests: Household sharing, Bills, CSV export/import.

Preserves default state (admin=user_testcfo01, partner=user_wife01 joined) at end.
"""
import io
import os
import csv
import subprocess
from datetime import datetime, timedelta, timezone
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"

ADMIN_TOK = "test_session_cfo_001"
PARTNER_TOK = "sess_wife"
STRANGER_TOK = "sess_stranger_r3"

H_ADMIN = {"Authorization": f"Bearer {ADMIN_TOK}"}
H_PARTNER = {"Authorization": f"Bearer {PARTNER_TOK}"}
H_STRANGER = {"Authorization": f"Bearer {STRANGER_TOK}"}


def _mongo(js: str):
    return subprocess.run(
        ["mongosh", "--quiet", "--eval", f"use('fincfo_db'); {js}"],
        capture_output=True, text=True, timeout=15,
    )


@pytest.fixture(scope="module", autouse=True)
def seed_and_restore():
    # Ensure stranger user + session exists (fresh household)
    _mongo(
        "db.users.updateOne({user_id:'user_stranger_r3'},"
        "{$set:{user_id:'user_stranger_r3',email:'stranger@example.com',name:'Stranger',"
        "onboarded:true,household_id:null,role:'admin',active:true,created_at:new Date()}},{upsert:true});"
        "db.user_sessions.updateOne({session_token:'sess_stranger_r3'},"
        "{$set:{user_id:'user_stranger_r3',session_token:'sess_stranger_r3',"
        "expires_at:new Date(Date.now()+7*24*60*60*1000),created_at:new Date()}},{upsert:true});"
    )
    yield
    # Restore: put wife back in admin's household, cleanup stranger extras
    _mongo(
        "var admin=db.users.findOne({user_id:'user_testcfo01'});"
        "db.users.updateOne({user_id:'user_wife01'},{$set:{household_id:admin.household_id,role:'partner',onboarded:true,active:true}});"
        "db.users.updateOne({user_id:'user_stranger_r3'},{$set:{household_id:null,role:'admin'}});"
        "db.household_invites.deleteMany({status:'pending'});"
    )


# ---------------- Household GET & shape ----------------
class TestHouseholdShape:
    def test_get_household_admin(self):
        r = requests.get(f"{API}/household", headers=H_ADMIN, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["household"]["owner_user_id"] == "user_testcfo01"
        assert d["role"] == "admin"
        assert d["max_members"] == 2
        assert len(d["members"]) == 2  # already full from prior manual test
        assert d["can_invite"] is False  # full

    def test_get_household_partner(self):
        r = requests.get(f"{API}/household", headers=H_PARTNER, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "partner"
        assert d["can_invite"] is False  # partners cannot invite

    def test_dashboard_shared_shape(self):
        r = requests.get(f"{API}/dashboard", headers=H_ADMIN, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "members" in d and len(d["members"]) == 2
        assert d["is_shared"] is True
        assert "member_breakdown" in d
        assert "upcoming_bills" in d
        assert isinstance(d["member_breakdown"], list)
        assert isinstance(d["upcoming_bills"], list)

    def test_invite_forbidden_for_partner(self):
        r = requests.post(f"{API}/household/invite", headers=H_PARTNER, json={}, timeout=10)
        assert r.status_code == 403

    def test_invite_rejected_when_full(self):
        r = requests.post(f"{API}/household/invite", headers=H_ADMIN, json={}, timeout=10)
        assert r.status_code == 400  # full


# ---------------- Invite / Join full flow ----------------
class TestInviteJoinFlow:
    """Reset wife → admin creates invite → wife joins → stranger 3rd join rejected."""

    def test_full_flow(self):
        # Reset wife out of household
        _mongo(
            "db.users.updateOne({user_id:'user_wife01'},"
            "{$set:{household_id:null,role:'admin',onboarded:false}});"
            "db.household_invites.deleteMany({});"
        )

        # Now admin should be able to invite
        r = requests.get(f"{API}/household", headers=H_ADMIN, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert len(d["members"]) == 1
        assert d["can_invite"] is True

        # create invite
        inv = requests.post(f"{API}/household/invite", headers=H_ADMIN, json={}, timeout=10)
        assert inv.status_code == 200, inv.text
        code = inv.json().get("code")
        assert code and len(code) > 3

        # calling invite again returns SAME (reusable pending)
        inv2 = requests.post(f"{API}/household/invite", headers=H_ADMIN, json={}, timeout=10)
        assert inv2.json().get("code") == code

        # Bad code
        bad = requests.post(f"{API}/household/join", headers=H_PARTNER,
                            json={"code": "not-a-real-code"}, timeout=10)
        assert bad.status_code == 404

        # Wife joins
        j = requests.post(f"{API}/household/join", headers=H_PARTNER,
                          json={"code": code}, timeout=10)
        assert j.status_code == 200, j.text
        assert j.json()["ok"] is True

        # Verify state — partner sees admin's household
        me = requests.get(f"{API}/household", headers=H_PARTNER, timeout=10)
        assert me.status_code == 200
        assert me.json()["role"] == "partner"
        assert len(me.json()["members"]) == 2

        # Admin creates NEW invite for stranger — but household now full → 400
        inv3 = requests.post(f"{API}/household/invite", headers=H_ADMIN, json={}, timeout=10)
        assert inv3.status_code == 400  # full

        # Even if we manually seed a fresh code, join should reject cap
        _mongo(
            "var admin=db.users.findOne({user_id:'user_testcfo01'});"
            "db.household_invites.insertOne({id:'inv_test_r3',household_id:admin.household_id,"
            "code:'THIRD3RD',status:'pending',created_by:'user_testcfo01',created_at:new Date()});"
        )
        stranger_join = requests.post(f"{API}/household/join", headers=H_STRANGER,
                                      json={"code": "THIRD3RD"}, timeout=10)
        assert stranger_join.status_code == 400  # full

    def test_partner_cannot_remove_member(self):
        r = requests.delete(f"{API}/household/members/user_testcfo01",
                            headers=H_PARTNER, timeout=10)
        assert r.status_code == 403


# ---------------- Member attribution ----------------
class TestMemberAttribution:
    def test_partner_txn_has_member_id(self):
        # ensure wallet exists in shared household
        w = requests.get(f"{API}/wallets", headers=H_PARTNER, timeout=10)
        assert w.status_code == 200
        wallets = w.json()
        assert len(wallets) > 0, "shared wallets should be visible to partner"
        wid = wallets[0]["id"]

        # Partner creates a small expense
        payload = {"type": "expense", "amount": 12345, "wallet_id": wid,
                   "category": "Makanan & Minuman", "note": "TEST_partner_r3"}
        r = requests.post(f"{API}/transactions", headers=H_PARTNER, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["member_id"] == "user_wife01"
        txn_id = d["id"]

        # Admin lists — should see it
        lst = requests.get(f"{API}/transactions", headers=H_ADMIN, timeout=10)
        found = [t for t in lst.json() if t["id"] == txn_id]
        assert found and found[0]["member_id"] == "user_wife01"

        # Filter by member_id=admin should NOT include this
        f_admin = requests.get(f"{API}/transactions?member_id=user_testcfo01",
                               headers=H_ADMIN, timeout=10)
        assert all(t["member_id"] == "user_testcfo01" for t in f_admin.json())

        # Filter by partner should include it
        f_partner = requests.get(f"{API}/transactions?member_id=user_wife01",
                                 headers=H_ADMIN, timeout=10)
        assert any(t["id"] == txn_id for t in f_partner.json())

        # cleanup
        requests.delete(f"{API}/transactions/{txn_id}", headers=H_ADMIN, timeout=10)


# ---------------- Bills ----------------
class TestBills:
    def test_bill_crud_and_pay(self):
        # Get a wallet from admin
        wallets = requests.get(f"{API}/wallets", headers=H_ADMIN, timeout=10).json()
        wid = wallets[0]["id"]
        w_before = wallets[0]["balance"]

        today = datetime.now(timezone.utc).date()
        due = (today + timedelta(days=3)).isoformat()

        # Create bill
        payload = {"name": "TEST_Listrik_R3", "amount": 55000,
                   "category": "Tagihan & Utilitas", "recurrence": "monthly",
                   "next_due_date": due, "wallet_id": wid}
        r = requests.post(f"{API}/bills", headers=H_ADMIN, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        bill = r.json()
        bid = bill["id"]

        # List
        lst = requests.get(f"{API}/bills", headers=H_ADMIN, timeout=10)
        assert lst.status_code == 200
        assert any(b["id"] == bid for b in lst.json())

        # Upcoming (due within 7 days) should include it
        up = requests.get(f"{API}/bills/upcoming?days=7", headers=H_ADMIN, timeout=10)
        assert up.status_code == 200
        assert any(b["id"] == bid for b in up.json())

        # Update
        upd = requests.put(f"{API}/bills/{bid}", headers=H_ADMIN,
                           json={**payload, "amount": 60000}, timeout=10)
        assert upd.status_code == 200
        assert upd.json()["amount"] == 60000

        # Pay — should advance next_due_date and decrement wallet
        pay = requests.post(f"{API}/bills/{bid}/pay", headers=H_ADMIN, timeout=10)
        assert pay.status_code == 200, pay.text
        new_due = pay.json()["next_due_date"]
        assert new_due > due  # advanced

        # Wallet balance decremented by 60000
        w_after = [w for w in requests.get(f"{API}/wallets", headers=H_ADMIN).json() if w["id"] == wid][0]
        assert w_after["balance"] == w_before - 60000, f"before={w_before} after={w_after['balance']}"

        # Reset wallet balance and delete bill for cleanup
        requests.put(f"{API}/wallets/{wid}", headers=H_ADMIN,
                     json={"name": w_after["name"], "type": w_after["type"],
                           "balance": w_before, "color": w_after.get("color", "#00E676"),
                           "icon": w_after.get("icon", "wallet")}, timeout=10)
        # delete transaction created by pay
        txns = requests.get(f"{API}/transactions", headers=H_ADMIN).json()
        for t in txns:
            if t.get("source") == "bill" and t.get("note", "").endswith("TEST_Listrik_R3"):
                requests.delete(f"{API}/transactions/{t['id']}", headers=H_ADMIN, timeout=10)
        requests.delete(f"{API}/bills/{bid}", headers=H_ADMIN, timeout=10)

    def test_once_bill_marks_paid(self):
        wallets = requests.get(f"{API}/wallets", headers=H_ADMIN).json()
        wid = wallets[0]["id"]
        due = datetime.now(timezone.utc).date().isoformat()
        r = requests.post(f"{API}/bills", headers=H_ADMIN, json={
            "name": "TEST_OnceR3", "amount": 1000, "recurrence": "once",
            "next_due_date": due, "wallet_id": None}, timeout=10)
        bid = r.json()["id"]
        pay = requests.post(f"{API}/bills/{bid}/pay", headers=H_ADMIN, timeout=10)
        assert pay.status_code == 200
        assert pay.json()["is_paid_current_cycle"] is True
        # Not in upcoming anymore
        up = requests.get(f"{API}/bills/upcoming?days=7", headers=H_ADMIN).json()
        assert not any(b["id"] == bid for b in up)
        requests.delete(f"{API}/bills/{bid}", headers=H_ADMIN, timeout=10)


# ---------------- CSV export / import ----------------
class TestCsv:
    def test_export_returns_csv(self):
        r = requests.get(f"{API}/transactions/export", headers=H_ADMIN, timeout=20)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        rows = list(csv.reader(io.StringIO(r.text)))
        assert rows[0] == ["date", "type", "amount", "category", "wallet",
                           "to_wallet", "note", "member"]

    def test_import_creates_txns_and_wallet(self):
        # Import a CSV that references a wallet name that does NOT exist yet
        wallet_name = "TEST_ImportCashR3"
        csv_body = (
            "date,type,amount,category,wallet,note\n"
            f"2026-01-05,expense,15000,Makanan & Minuman,{wallet_name},TEST_import_row_A\n"
            f"2026-01-06,income,50000,Gaji,{wallet_name},TEST_import_row_B\n"
        )
        files = {"file": ("import.csv", csv_body.encode("utf-8"), "text/csv")}
        r = requests.post(f"{API}/transactions/import", headers=H_ADMIN, files=files, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["imported"] == 2, d

        # Wallet auto-created (cash)
        wallets = requests.get(f"{API}/wallets", headers=H_ADMIN).json()
        new_w = [w for w in wallets if w["name"] == wallet_name]
        assert new_w and new_w[0]["type"] == "cash"
        # Balance = 50000 income - 15000 expense = 35000
        assert new_w[0]["balance"] == 35000, new_w[0]

        # Cleanup: delete wallet and imported txns
        wid = new_w[0]["id"]
        txns = requests.get(f"{API}/transactions", headers=H_ADMIN).json()
        for t in txns:
            if t.get("source") == "csv_import" and t.get("wallet_id") == wid:
                requests.delete(f"{API}/transactions/{t['id']}", headers=H_ADMIN, timeout=10)
        requests.delete(f"{API}/wallets/{wid}", headers=H_ADMIN, timeout=10)

    def test_import_rejects_non_csv(self):
        files = {"file": ("bad.txt", b"not csv", "text/plain")}
        r = requests.post(f"{API}/transactions/import", headers=H_ADMIN, files=files, timeout=10)
        assert r.status_code == 400


# ---------------- Regression smoke ----------------
class TestRegression:
    def test_wallets_budget_goals_networth(self):
        assert requests.get(f"{API}/wallets", headers=H_ADMIN).status_code == 200
        assert requests.get(f"{API}/budget", headers=H_ADMIN).status_code == 200
        assert requests.get(f"{API}/goals", headers=H_ADMIN).status_code == 200
        assert requests.get(f"{API}/analytics", headers=H_ADMIN).status_code == 200
        assert requests.get(f"{API}/networth/history", headers=H_ADMIN).status_code == 200
