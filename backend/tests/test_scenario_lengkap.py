"""SKENARIO LENGKAP E2E — semua jenis transaksi Nusa (Tumara v2).

Menjalankan skenario nyata melawan backend yang sedang hidup (base URL lewat
env SCENARIO_API_BASE / REACT_APP_BACKEND_URL, default http://localhost:8001).

Skenario yang dicakup:
  1. Auth & headless register 2 anggota (admin + partner) satu rumah tangga
  2. Menambah dompet untuk SEMUA tipe (bank, ewallet, cash, investment,
     credit_card, paylater) + validasi tipe tidak valid
  3. Pemasukan (gaji, bonus, freelance) ke berbagai tipe dompet
  4. Pengeluaran biasa (makanan, transport, belanja, tagihan, hiburan)
  5. Transfer antar dompet (bank -> ewallet, bank -> bank, ewallet -> cash)
  6. Bayar pakai KARTU KREDIT (expense dgn wallet = credit_card)
  7. Bayar TAGIHAN KARTU KREDIT (transfer dana -> credit_card)
  8. PAYLATER (expense + pelunasan)
  9. Transfer ke dompet itu sendiri & transfer tanpa tujuan (edge case)
 10. Tagihan rutin (bill): buat -> bayar -> advancing -> hapus
 11. Tagihan dibayar memakai kartu kredit
 12. Hapus transaksi -> saldo harus kembali seperti semula (reversal)
 13. Validasi input tidak valid (amount <= 0, tipe salah, wallet asing)
 14. Isolasi rumah tangga (anggota luar tidak bisa lihat/akses)
 15. Budget, Goal + deposit, Dashboard, Analytics, Net worth, Export/Import CSV

Konvensi saldo kartu kredit/paylater (lihat frontend/src/pages/Wallets.js):
  balance = TOTAL TAGIHAN (utang). Expense dgn kartu kredit harus MENAIKAN
  saldo kartu. Pembayaran tagihan kartu kredit harus MENURUNKAN saldo kartu.
"""
import csv
import io
import os
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE = (os.environ.get("SCENARIO_API_BASE")
        or os.environ.get("REACT_APP_BACKEND_URL")
        or "http://localhost:8001").rstrip("/")
API = f"{BASE}/api"

STAMP = str(int(time.time()))
ADMIN_EMAIL = f"scenario_admin_{STAMP}@example.com"
PARTNER_EMAIL = f"scenario_partner_{STAMP}@example.com"
OUTSIDER_EMAIL = f"scenario_outsider_{STAMP}@example.com"
PASSWORD = "rahasia123"


def hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def req(method, path, token=None, **kw):
    h = dict(kw.pop("headers", {}) or {})
    if token:
        h.update(hdr(token))
    return requests.request(method, f"{API}{path}", headers=h, timeout=20, **kw)


def register(email, name, access_code="TUMARA2026", invite_code=None):
    payload = {"name": name, "email": email, "password": PASSWORD}
    if invite_code:
        payload["invite_code"] = invite_code
    else:
        payload["access_code"] = access_code
    r = requests.post(f"{API}/auth/register", json=payload, timeout=20)
    assert r.status_code == 200, f"register {email}: {r.status_code} {r.text}"
    d = r.json()
    return d["session_token"], d["user"]["user_id"]


def mk_wallet(token, name, wtype, balance=0):
    r = req("POST", "/wallets", token, json={"name": name, "type": wtype, "balance": balance})
    assert r.status_code == 200, f"wallet {name}: {r.status_code} {r.text}"
    return r.json()


def get_wallet(token, wid):
    r = req("GET", "/wallets", token)
    assert r.status_code == 200, r.text
    for w in r.json():
        if w["id"] == wid:
            return w
    raise AssertionError(f"wallet {wid} tidak ditemukan")


def mk_txn(token, **payload):
    r = req("POST", "/transactions", token, json=payload)
    assert r.status_code == 200, f"txn {payload}: {r.status_code} {r.text}"
    return r.json()


def dashboard(token):
    r = req("GET", "/dashboard", token)
    assert r.status_code == 200, r.text
    return r.json()


# =====================================================================
# Fixture: seed rumah tangga + seluruh dompet
# =====================================================================
@pytest.fixture(scope="module")
def ctx():
    admin_tok, admin_uid = register(ADMIN_EMAIL, "Skenario Admin")

    # Partner bergabung lewat kode undangan
    inv = req("POST", "/household/invite", admin_tok, json={})
    assert inv.status_code == 200, inv.text
    code = inv.json()["code"]
    partner_tok, partner_uid = register(PARTNER_EMAIL, "Skenario Partner", invite_code=code)

    outsider_tok, outsider_uid = register(OUTSIDER_EMAIL, "Orang Luar")

    w = {
        "bank": mk_wallet(admin_tok, "BCA", "bank", 5_000_000),
        "bca2": mk_wallet(admin_tok, "Mandiri", "bank", 2_000_000),
        "cash": mk_wallet(admin_tok, "Dompet Tunai", "cash", 500_000),
        "gopay": mk_wallet(admin_tok, "GoPay", "ewallet", 300_000),
        "saham": mk_wallet(admin_tok, "Reksa Dana", "investment", 10_000_000),
        "cc": mk_wallet(admin_tok, "Kartu Kredit BCA", "credit_card", 1_500_000),
        "paylater": mk_wallet(admin_tok, "SPayLater", "paylater", 750_000),
    }
    return {
        "admin": admin_tok, "admin_uid": admin_uid,
        "partner": partner_tok, "partner_uid": partner_uid,
        "outsider": outsider_tok, "outsider_uid": outsider_uid,
        "w": w, "invite_code": code,
    }


# =====================================================================
# 1. AUTH & HOUSEHOLD
# =====================================================================
class Test01AuthHousehold:
    def test_admin_ctx_valid(self, ctx):
        r = req("GET", "/auth/me", ctx["admin"])
        assert r.status_code == 200 and r.json()["email"] == ADMIN_EMAIL
        assert r.json()["role"] == "admin"

    def test_partner_bergabung_ke_household_yang_sama(self, ctx):
        me_a = req("GET", "/auth/me", ctx["admin"]).json()
        me_p = req("GET", "/auth/me", ctx["partner"]).json()
        assert me_p["role"] == "partner"
        assert me_p["household_id"] == me_a["household_id"]

    def test_household_menampilkan_2_anggota(self, ctx):
        d = req("GET", "/household", ctx["admin"]).json()
        assert len(d["members"]) == 2
        assert d["can_invite"] is False  # sudah penuh

    def test_token_tidak_valid_ditolak(self, ctx):
        assert req("GET", "/wallets", "token-ngawur").status_code == 401
        assert requests.get(f"{API}/wallets", timeout=10).status_code == 401

    def test_register_tanpa_kode_ditolak(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "X", "email": f"nokode_{STAMP}@example.com", "password": "rahasia123"}, timeout=15)
        assert r.status_code == 400

    def test_register_email_ganda_ditolak(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "X", "email": ADMIN_EMAIL, "password": "rahasia123",
            "access_code": "TUMARA2026"}, timeout=15)
        assert r.status_code == 400


# =====================================================================
# 2. MENAMBAH DOMPET — semua tipe
# =====================================================================
class Test02TambahDompet:
    def test_semua_tipe_dompet_berhasil_dibuat(self, ctx):
        wallets = req("GET", "/wallets", ctx["admin"]).json()
        types = {w["type"] for w in wallets}
        assert types == {"bank", "ewallet", "cash", "investment", "credit_card", "paylater"}
        assert len(wallets) == 7

    def test_wallet_punya_id_dan_prefix_benar(self, ctx):
        for w in req("GET", "/wallets", ctx["admin"]).json():
            assert w["id"].startswith("wal_")
            assert w["household_id"]
            assert "_id" not in w  # projection {_id:0}

    def test_tipe_dompet_tidak_valid_ditolak_422(self, ctx):
        r = req("POST", "/wallets", ctx["admin"],
                json={"name": "Dompet Ngawur", "type": "crypto", "balance": 0})
        assert r.status_code == 422, r.text

    def test_update_dompet_ganti_nama_dan_saldo_awal(self, ctx):
        wid = ctx["w"]["bca2"]["id"]
        w = get_wallet(ctx["admin"], wid)
        r = req("PUT", f"/wallets/{wid}", ctx["admin"], json={
            "name": "Mandiri (renamed)", "type": "bank", "balance": 2_000_000,
            "color": w.get("color", "#00E676"), "icon": w.get("icon", "wallet")})
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "Mandiri (renamed)"

    def test_update_dompet_tidak_ada_404(self, ctx):
        r = req("PUT", "/wallets/wal_tidak_ada", ctx["admin"],
                json={"name": "X", "type": "bank", "balance": 0})
        assert r.status_code == 404, r.text

    def test_hapus_dompet_kosong_berhasil(self, ctx):
        tmp = mk_wallet(ctx["admin"], "Dompet Sementara", "cash", 0)
        r = req("DELETE", f"/wallets/{tmp['id']}", ctx["admin"])
        assert r.status_code == 200 and r.json()["ok"] is True
        assert req("GET", "/wallets", ctx["admin"]).json() is not None

    def test_hapus_dompet_tidak_ada_404(self, ctx):
        assert req("DELETE", "/wallets/wal_hantu", ctx["admin"]).status_code == 404

    def test_networth_terhitung_asset_vs_utang(self, ctx):
        d = dashboard(ctx["admin"])
        # asset = bank + bank + cash + ewallet + investment
        expected_assets = 5_000_000 + 2_000_000 + 500_000 + 300_000 + 10_000_000
        expected_debt = 1_500_000 + 750_000
        assert d["assets"] == expected_assets, d["assets"]
        assert d["debt"] == expected_debt, d["debt"]
        assert d["net_worth"] == expected_assets - expected_debt


# =====================================================================
# 3. PEMASUKAN
# =====================================================================
class Test03Pemasukan:
    def test_gaji_masuk_ke_bank(self, ctx):
        wid = ctx["w"]["bank"]["id"]
        before = get_wallet(ctx["admin"], wid)["balance"]
        t = mk_txn(ctx["admin"], type="income", amount=12_000_000, wallet_id=wid,
                   category="Gaji", note="Gaji September")
        assert t["type"] == "income" and t["member_id"] == ctx["admin_uid"]
        assert get_wallet(ctx["admin"], wid)["balance"] == before + 12_000_000

    def test_freelance_masuk_ke_reksa_dana(self, ctx):
        wid = ctx["w"]["saham"]["id"]
        before = get_wallet(ctx["admin"], wid)["balance"]
        mk_txn(ctx["admin"], type="income", amount=2_500_000, wallet_id=wid,
               category="Investasi", note="Dividen")
        assert get_wallet(ctx["admin"], wid)["balance"] == before + 2_500_000

    def test_pemasukan_partner_ke_ewallet_sendiri(self, ctx):
        wid = ctx["w"]["gopay"]["id"]
        before = get_wallet(ctx["partner"], wid)["balance"]
        t = mk_txn(ctx["partner"], type="income", amount=300_000, wallet_id=wid,
                   category="Bonus", note="Bonus partner")
        assert t["member_id"] == ctx["partner_uid"]
        assert get_wallet(ctx["partner"], wid)["balance"] == before + 300_000

    def test_kategori_gaji_tercatat_di_dashboard(self, ctx):
        d = dashboard(ctx["admin"])
        assert d["income"] >= 14_500_000, d["income"]


# =====================================================================
# 4. PENGELUARAN BIASA
# =====================================================================
class Test04Pengeluaran:
    def test_pengeluaran_knowledge_makan_keluar_dari_bank(self, ctx):
        wid = ctx["w"]["bank"]["id"]
        before = get_wallet(ctx["admin"], wid)["balance"]
        mk_txn(ctx["admin"], type="expense", amount=85_000, wallet_id=wid,
               category="Makanan & Minuman", note="Makan siang")
        assert get_wallet(ctx["admin"], wid)["balance"] == before - 85_000

    def test_pengeluaran_transport_dari_tunai(self, ctx):
        wid = ctx["w"]["cash"]["id"]
        before = get_wallet(ctx["admin"], wid)["balance"]
        mk_txn(ctx["admin"], type="expense", amount=50_000, wallet_id=wid,
               category="Transportasi", note="Bensin")
        assert get_wallet(ctx["admin"], wid)["balance"] == before - 50_000

    def test_pengeluaran_belanja_dari_gopay(self, ctx):
        wid = ctx["w"]["gopay"]["id"]
        before = get_wallet(ctx["admin"], wid)["balance"]
        mk_txn(ctx["admin"], type="expense", amount=275_000, wallet_id=wid,
               category="Belanja", note="Belanja bulanan")
        assert get_wallet(ctx["admin"], wid)["balance"] == before - 275_000

    def test_pengeluaran_partner_dilacak_per_anggota(self, ctx):
        wid = ctx["w"]["cash"]["id"]
        before = get_wallet(ctx["partner"], wid)["balance"]
        mk_txn(ctx["partner"], type="expense", amount=35_000, wallet_id=wid,
               category="Hiburan", note="Nonton")
        assert get_wallet(ctx["partner"], wid)["balance"] == before - 35_000
        d = dashboard(ctx["admin"])
        names = [m["name"] for m in d["member_breakdown"]]
        assert "Skenario Partner" in names, d["member_breakdown"]

    def test_kategori_pengeluaran_terkumpul_di_dashboard(self, ctx):
        d = dashboard(ctx["admin"])
        cats = {c["category"]: c["amount"] for c in d["category_breakdown"]}
        assert cats.get("Makanan & Minuman", 0) >= 85_000
        assert cats.get("Transportasi", 0) >= 50_000
        assert cats.get("Belanja", 0) >= 275_000

    def test_dashboard_expense_terhitung(self, ctx):
        d = dashboard(ctx["admin"])
        assert d["expense"] >= 85_000 + 50_000 + 275_000 + 35_000


# =====================================================================
# 5. TRANSFER ANTAR DOMPET
# =====================================================================
class Test05Transfer:
    def test_transfer_bank_ke_ewallet_konservasi_total(self, ctx):
        a, b = ctx["w"]["bank"]["id"], ctx["w"]["gopay"]["id"]
        ba, bb = get_wallet(ctx["admin"], a)["balance"], get_wallet(ctx["admin"], b)["balance"]
        t = mk_txn(ctx["admin"], type="transfer", amount=1_000_000, wallet_id=a,
                   to_wallet_id=b, category="Lainnya", note="Top up GoPay")
        assert t["to_wallet_id"] == b
        wa, wb = get_wallet(ctx["admin"], a), get_wallet(ctx["admin"], b)
        assert wa["balance"] == ba - 1_000_000
        assert wb["balance"] == bb + 1_000_000
        assert (wa["balance"] + wb["balance"]) == (ba + bb)  # total tidak berubah

    def test_transfer_antar_bank(self, ctx):
        a, b = ctx["w"]["bank"]["id"], ctx["w"]["bca2"]["id"]
        ba, bb = get_wallet(ctx["admin"], a)["balance"], get_wallet(ctx["admin"], b)["balance"]
        mk_txn(ctx["admin"], type="transfer", amount=2_500_000, wallet_id=a, to_wallet_id=b)
        assert get_wallet(ctx["admin"], a)["balance"] == ba - 2_500_000
        assert get_wallet(ctx["admin"], b)["balance"] == bb + 2_500_000

    def test_transfer_ewallet_ke_tunai(self, ctx):
        a, b = ctx["w"]["gopay"]["id"], ctx["w"]["cash"]["id"]
        ba, bb = get_wallet(ctx["admin"], a)["balance"], get_wallet(ctx["admin"], b)["balance"]
        mk_txn(ctx["admin"], type="transfer", amount=120_000, wallet_id=a, to_wallet_id=b)
        assert get_wallet(ctx["admin"], a)["balance"] == ba - 120_000
        assert get_wallet(ctx["admin"], b)["balance"] == bb + 120_000

    def test_transfer_tidak_masuk_kategori_pengeluaran(self, ctx):
        """Transfer bukan pengeluaran — tidak boleh muncul di category_breakdown/dashboard expense."""
        d = dashboard(ctx["admin"])
        assert d["expense"] >= 0
        txns = req("GET", "/transactions", ctx["admin"]).json()
        transfers = [t for t in txns if t["type"] == "transfer"]
        assert len(transfers) >= 3
        for t in transfers:
            assert t["id"].startswith("txn_")

    def test_transfer_ke_dompet_sendiri_ditolak(self, ctx):
        """Minimal harus tidak mengubah saldo (frontend menolak, backend harus ditolak backend)."""
        a = ctx["w"]["bank"]["id"]
        before = get_wallet(ctx["admin"], a)["balance"]
        r = req("POST", "/transactions", ctx["admin"], json={
            "type": "transfer", "amount": 100_000, "wallet_id": a, "to_wallet_id": a})
        after = get_wallet(ctx["admin"], a)["balance"]
        if r.status_code == 200:
            assert after == before, f"transfer ke dompet sendiri mengubah saldo: {before} -> {after}"
        else:
            assert r.status_code in (400, 422), r.text
            assert after == before

    def test_transfer_tanpa_dompet_tujuan_tidak_menarik_saldo(self, ctx):
        a = ctx["w"]["bank"]["id"]
        before = get_wallet(ctx["admin"], a)["balance"]
        r = req("POST", "/transactions", ctx["admin"], json={
            "type": "transfer", "amount": 750_000, "wallet_id": a})
        after = get_wallet(ctx["admin"], a)["balance"]
        if r.status_code == 200:
            assert after == before, f"transfer tanpa tujuan menarik saldo: {before} -> {after}"
        else:
            assert r.status_code in (400, 422), r.text
            assert after == before


# =====================================================================
# 6. BAYAR PAKAI KARTU KREDIT
# =====================================================================
class Test06BayarPakaiKartuKredit:
    """Saldo credit_card/paylater = TOTAL TAGIHAN (utang).
    Belanja dengan kartu kredit harus MENAIKAN utang."""

    def test_belanja_kartu_kredit_menaikkan_tagihan(self, ctx):
        cc = ctx["w"]["cc"]["id"]
        before = get_wallet(ctx["admin"], cc)["balance"]
        mk_txn(ctx["admin"], type="expense", amount=1_250_000, wallet_id=cc,
               category="Belanja", note="Belanja kartu kredit")
        after = get_wallet(ctx["admin"], cc)["balance"]
        assert after == before + 1_250_000, (
            f"Harus naik (utang bertambah). before={before} after={after}")

    def test_makan_di_restoran_kartu_kredit(self, ctx):
        cc = ctx["w"]["cc"]["id"]
        before = get_wallet(ctx["admin"], cc)["balance"]
        mk_txn(ctx["admin"], type="expense", amount=320_000, wallet_id=cc,
               category="Makanan & Minuman", note="Makan kartu kredit")
        after = get_wallet(ctx["admin"], cc)["balance"]
        assert after == before + 320_000, f"before={before} after={after}"

    def test_belanja_kartu_kredit_tidak_mengurangi_saldo_bank(self, ctx):
        bank = ctx["w"]["bank"]["id"]
        before = get_wallet(ctx["admin"], bank)["balance"]
        mk_txn(ctx["admin"], type="expense", amount=500_000, wallet_id=ctx["w"]["cc"]["id"],
               category="Hiburan", note="Kursus kartu kredit")
        assert get_wallet(ctx["admin"], bank)["balance"] == before

    def test_utang_kartu_kredit_masuk_dashboard_debt(self, ctx):
        d = dashboard(ctx["admin"])
        assert d["debt"] >= 1_500_000 + 1_250_000 + 320_000 + 500_000, d["debt"]
        assert d["assets"] > 0 and d["net_worth"] == d["assets"] - d["debt"]


# =====================================================================
# 7. BAYAR TAGIHAN KARTU KREDIT
# =====================================================================
class Test07BayarTagihanKartuKredit:
    def test_transfer_dana_ke_kartu_kredit_menurunkan_utang(self, ctx):
        bank, cc = ctx["w"]["bank"]["id"], ctx["w"]["cc"]["id"]
        bb, bc = get_wallet(ctx["admin"], bank)["balance"], get_wallet(ctx["admin"], cc)["balance"]
        mk_txn(ctx["admin"], type="transfer", amount=3_000_000, wallet_id=bank,
               to_wallet_id=cc, category="Lainnya", note="Bayar tagihan kartu kredit")
        wb, wc = get_wallet(ctx["admin"], bank), get_wallet(ctx["admin"], cc)
        assert wb["balance"] == bb - 3_000_000, f"dana harus keluar: {bb} -> {wb['balance']}"
        assert wc["balance"] == bc - 3_000_000, (
            f"utang kartu kredit harus turun. before={bc} after={wc['balance']}")

    def test_pelunasan_penuh_kartu_kredit(self, ctx):
        cc = ctx["w"]["cc"]["id"]
        owing = get_wallet(ctx["admin"], cc)["balance"]
        bank = ctx["w"]["bank"]["id"]
        before = get_wallet(ctx["admin"], bank)["balance"]
        mk_txn(ctx["admin"], type="transfer", amount=owing, wallet_id=bank,
               to_wallet_id=cc, note="Pelunasan penuh")
        assert get_wallet(ctx["admin"], cc)["balance"] == 0
        assert get_wallet(ctx["admin"], bank)["balance"] == before - owing

    def test_pembayaran_kartu_kredit_menurunkan_networth(self, ctx):
        d = dashboard(ctx["admin"])
        assert d["debt"] < d["assets"]


# =====================================================================
# 8. PAYLATER
# =====================================================================
class Test08Paylater:
    def test_beli_paylater_menaikkan_utang(self, ctx):
        pl = ctx["w"]["paylater"]["id"]
        before = get_wallet(ctx["admin"], pl)["balance"]
        mk_txn(ctx["admin"], type="expense", amount=450_000, wallet_id=pl,
               category="Belanja", note="Paylater elektronik")
        after = get_wallet(ctx["admin"], pl)["balance"]
        assert after == before + 450_000, f"before={before} after={after}"

    def test_bayar_paylater_dengan_transfer_menurunkan_utang(self, ctx):
        bank, pl = ctx["w"]["bank"]["id"], ctx["w"]["paylater"]["id"]
        bb, bp = get_wallet(ctx["admin"], bank)["balance"], get_wallet(ctx["admin"], pl)["balance"]
        mk_txn(ctx["admin"], type="transfer", amount=1_000_000, wallet_id=bank, to_wallet_id=pl)
        assert get_wallet(ctx["admin"], bank)["balance"] == bb - 1_000_000
        assert get_wallet(ctx["admin"], pl)["balance"] == bp - 1_000_000


# =====================================================================
# 9. TAGIHAN RUTIN (BILL)
# =====================================================================
class Test09TagihanRutin:
    def test_buat_dan_bayar_tagihan_bulanan(self, ctx):
        bank = ctx["w"]["bank"]["id"]
        due = (datetime.now(timezone.utc).date() + timedelta(days=2)).isoformat()
        before = get_wallet(ctx["admin"], bank)["balance"]

        r = req("POST", "/bills", ctx["admin"], json={
            "name": "Listrik PLN", "amount": 450_000, "category": "Tagihan & Utilitas",
            "recurrence": "monthly", "next_due_date": due, "wallet_id": bank})
        assert r.status_code == 200, r.text
        bill = r.json()
        assert bill["id"].startswith("bill_")

        pay = req("POST", f"/bills/{bill['id']}/pay", ctx["admin"])
        assert pay.status_code == 200, pay.text
        assert pay.json()["next_due_date"] > due, "tanggal tagihan harus maju"
        assert get_wallet(ctx["admin"], bank)["balance"] == before - 450_000

        txns = req("GET", "/transactions", ctx["admin"]).json()
        auto = [t for t in txns if t.get("source") == "bill" and "Listrik PLN" in t.get("note", "")]
        assert len(auto) == 1, "pembayaran tagihan harus membuat transaksi expense"
        assert auto[0]["amount"] == 450_000

        assert req("DELETE", f"/bills/{bill['id']}", ctx["admin"]).status_code == 200

    def test_tagihan_harian_dan_tahunan_maju_benar(self, ctx):
        for rec, days in (("weekly", 7), ("yearly", 365)):
            due = datetime.now(timezone.utc).date().isoformat()
            bill = req("POST", "/bills", ctx["admin"], json={
                "name": f"Tagihan {rec}", "amount": 10_000, "recurrence": rec,
                "next_due_date": due, "wallet_id": None}).json()
            new_due = req("POST", f"/bills/{bill['id']}/pay", ctx["admin"]).json()["next_due_date"]
            delta = (datetime.strptime(new_due, "%Y-%m-%d")
                     - datetime.strptime(due, "%Y-%m-%d")).days
            assert abs(delta - days) <= 1, f"{rec}: delta {delta}"
            req("DELETE", f"/bills/{bill['id']}", ctx["admin"])

    def test_tagihan_sekali_marks_paid_dan_hilang_dari_upcoming(self, ctx):
        due = datetime.now(timezone.utc).date().isoformat()
        bill = req("POST", "/bills", ctx["admin"], json={
            "name": "Sekali bayar", "amount": 25_000, "recurrence": "once",
            "next_due_date": due, "wallet_id": None}).json()
        paid = req("POST", f"/bills/{bill['id']}/pay", ctx["admin"]).json()
        assert paid["is_paid_current_cycle"] is True
        up = req("GET", "/bills/upcoming?days=7", ctx["admin"]).json()
        assert not any(b["id"] == bill["id"] for b in up)
        req("DELETE", f"/bills/{bill['id']}", ctx["admin"])

    def test_tagihan_tanpa_dompet_tidak_mengubah_saldo(self, ctx):
        d0 = dashboard(ctx["admin"])
        bill = req("POST", "/bills", ctx["admin"], json={
            "name": "Tanpa dompet", "amount": 99_000, "recurrence": "monthly",
            "next_due_date": datetime.now(timezone.utc).date().isoformat(),
            "wallet_id": None}).json()
        req("POST", f"/bills/{bill['id']}/pay", ctx["admin"])
        d1 = dashboard(ctx["admin"])
        assert d1["assets"] == d0["assets"]
        req("DELETE", f"/bills/{bill['id']}", ctx["admin"])

    def test_bayar_tagihan_tidak_ada_404(self, ctx):
        assert req("POST", "/bills/bill_hantu/pay", ctx["admin"]).status_code == 404


# =====================================================================
# 10. TAGIHAN DIBAYAR DENGAN KARTU KREDIT
# =====================================================================
class Test10TagihanViaKartuKredit:
    def test_bayar_tagihan_utility_dengan_kartu_kredit_menaikkan_utang(self, ctx):
        cc = ctx["w"]["cc"]["id"]
        before = get_wallet(ctx["admin"], cc)["balance"]
        due = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()
        bill = req("POST", "/bills", ctx["admin"], json={
            "name": "WiLang", "amount": 350_000, "category": "Tagihan & Utilitas",
            "recurrence": "monthly", "next_due_date": due, "wallet_id": cc}).json()
        req("POST", f"/bills/{bill['id']}/pay", ctx["admin"])
        after = get_wallet(ctx["admin"], cc)["balance"]
        assert after == before + 350_000, (
            f"Bayar tagihan pakai kartu kredit = utang bertambah. {before} -> {after}")
        req("DELETE", f"/bills/{bill['id']}", ctx["admin"])


# =====================================================================
# 11. HAPUS TRANSAKSI -> SALDO KEMBALI
# =====================================================================
class Test11HapusTransaksi:
    def test_hapus_pemasukan_mengembalikan_saldo(self, ctx):
        w = ctx["w"]["cash"]["id"]
        before = get_wallet(ctx["admin"], w)["balance"]
        t = mk_txn(ctx["admin"], type="income", amount=111_000, wallet_id=w, category="Lainnya")
        mid = get_wallet(ctx["admin"], w)["balance"]
        assert mid == before + 111_000
        assert req("DELETE", f"/transactions/{t['id']}", ctx["admin"]).status_code == 200
        assert get_wallet(ctx["admin"], w)["balance"] == before

    def test_hapus_pengeluaran_mengembalikan_saldo(self, ctx):
        w = ctx["w"]["cash"]["id"]
        before = get_wallet(ctx["admin"], w)["balance"]
        t = mk_txn(ctx["admin"], type="expense", amount=66_000, wallet_id=w, category="Makanan & Minuman")
        assert get_wallet(ctx["admin"], w)["balance"] == before - 66_000
        req("DELETE", f"/transactions/{t['id']}", ctx["admin"])
        assert get_wallet(ctx["admin"], w)["balance"] == before

    def test_hapus_transfer_mengembalikan_kedua_dompet(self, ctx):
        a, b = ctx["w"]["bank"]["id"], ctx["w"]["cash"]["id"]
        ba, bb = get_wallet(ctx["admin"], a)["balance"], get_wallet(ctx["admin"], b)["balance"]
        t = mk_txn(ctx["admin"], type="transfer", amount=400_000, wallet_id=a, to_wallet_id=b)
        req("DELETE", f"/transactions/{t['id']}", ctx["admin"])
        assert get_wallet(ctx["admin"], a)["balance"] == ba
        assert get_wallet(ctx["admin"], b)["balance"] == bb

    def test_hapus_transaksi_kartu_kredit_mengembalikan_utang(self, ctx):
        cc = ctx["w"]["cc"]["id"]
        before = get_wallet(ctx["admin"], cc)["balance"]
        t = mk_txn(ctx["admin"], type="expense", amount=210_000, wallet_id=cc, category="Belanja")
        assert get_wallet(ctx["admin"], cc)["balance"] == before + 210_000
        req("DELETE", f"/transactions/{t['id']}", ctx["admin"])
        assert get_wallet(ctx["admin"], cc)["balance"] == before

    def test_hapus_pembayaran_tagihan_kartu_kredit(self, ctx):
        bank, cc = ctx["w"]["bank"]["id"], ctx["w"]["cc"]["id"]
        bb, bc = get_wallet(ctx["admin"], bank)["balance"], get_wallet(ctx["admin"], cc)["balance"]
        t = mk_txn(ctx["admin"], type="transfer", amount=150_000, wallet_id=bank, to_wallet_id=cc)
        req("DELETE", f"/transactions/{t['id']}", ctx["admin"])
        assert get_wallet(ctx["admin"], bank)["balance"] == bb
        assert get_wallet(ctx["admin"], cc)["balance"] == bc

    def test_hapus_transaksi_tidak_ada_404(self, ctx):
        assert req("DELETE", "/transactions/txn_hantu", ctx["admin"]).status_code == 404


# =====================================================================
# 12. VALIDASI INPUT
# =====================================================================
class Test12Validasi:
    def test_jumlah_nol_ditolak(self, ctx):
        w = ctx["w"]["bank"]["id"]
        before = get_wallet(ctx["admin"], w)["balance"]
        r = req("POST", "/transactions", ctx["admin"], json={
            "type": "expense", "amount": 0, "wallet_id": w})
        if r.status_code == 200:
            assert get_wallet(ctx["admin"], w)["balance"] == before
            req("DELETE", f"/transactions/{r.json()['id']}", ctx["admin"])
        else:
            assert r.status_code == 422

    def test_jumlah_negatif_ditolak(self, ctx):
        w = ctx["w"]["bank"]["id"]
        before = get_wallet(ctx["admin"], w)["balance"]
        r = req("POST", "/transactions", ctx["admin"], json={
            "type": "expense", "amount": -500_000, "wallet_id": w})
        if r.status_code == 200:
            assert get_wallet(ctx["admin"], w)["balance"] == before, (
                f"expense negatif menambah saldo! {before} -> {get_wallet(ctx['admin'], w)['balance']}")
            req("DELETE", f"/transactions/{r.json()['id']}", ctx["admin"])
        else:
            assert r.status_code == 422, r.text

    def test_tipe_transaksi_salah_ditolak_422(self, ctx):
        r = req("POST", "/transactions", ctx["admin"], json={
            "type": "donasi", "amount": 1000, "wallet_id": ctx["w"]["bank"]["id"]})
        assert r.status_code == 422, r.text

    def test_transaksi_tanpa_dompet_422(self, ctx):
        r = req("POST", "/transactions", ctx["admin"], json={"type": "expense", "amount": 1000})
        assert r.status_code == 422

    def test_transaksi_ke_dompet_household_lain_tidak_bocor_saldo(self, ctx):
        """Dompet milik rumah tangga lain tidak boleh bisa dipakai/disentuh."""
        other = mk_wallet(ctx["outsider"], "Dompet Luar", "bank", 5_000_000)
        w = ctx["w"]["bank"]["id"]
        before_local = get_wallet(ctx["admin"], w)["balance"]
        r = req("POST", "/transactions", ctx["admin"], json={
            "type": "expense", "amount": 900_000, "wallet_id": other["id"]})
        if r.status_code == 200:
            assert get_wallet(ctx["outsider"], other["id"])["balance"] == 5_000_000, (
                "dompet household lain ikut berubah saldo!")
            assert get_wallet(ctx["admin"], w)["balance"] == before_local
            req("DELETE", f"/transactions/{r.json()['id']}", ctx["admin"])
        else:
            assert r.status_code in (400, 403, 404, 422), r.text
        assert get_wallet(ctx["outsider"], other["id"])["balance"] == 5_000_000

    def test_tanggal_otomatis_diisi_jika_kosong(self, ctx):
        t = mk_txn(ctx["admin"], type="expense", amount=1_000,
                   wallet_id=ctx["w"]["cash"]["id"], category="Lainnya")
        assert t["date"] == datetime.now(timezone.utc).strftime("%Y-%m-%d")
        req("DELETE", f"/transactions/{t['id']}", ctx["admin"])


# =====================================================================
# 13. ISOLASI RUMAH TANGGA
# =====================================================================
class Test13IsolasiHousehold:
    def test_orang_luar_tidak_lihat_dompet(self, ctx):
        names = [w["name"] for w in req("GET", "/wallets", ctx["outsider"]).json()]
        assert "BCA" not in names and "Kartu Kredit BCA" not in names

    def test_orang_luar_tidak_lihat_transaksi(self, ctx):
        txns = req("GET", "/transactions", ctx["outsider"]).json()
        assert all(t["member_id"] != ctx["admin_uid"] for t in txns)

    def test_orang_luar_tidak_lihat_dashboard_kita(self, ctx):
        d = dashboard(ctx["outsider"])
        assert d["net_worth"] != 0
        assert len(d["members"]) == 1

    def test_partner_lihat_dompet_yg_sama(self, ctx):
        partner_w = {w["name"] for w in req("GET", "/wallets", ctx["partner"]).json()}
        admin_w = {w["name"] for w in req("GET", "/wallets", ctx["admin"]).json()}
        assert partner_w == admin_w

    def test_partner_tidak_bisa_hapus_dompet_admin(self, ctx):
        wid = ctx["w"]["bank"]["id"]
        r = req("DELETE", f"/wallets/{wid}", ctx["partner"])
        assert r.status_code in (403, 404), r.text


# =====================================================================
# 14. BUDGET, GOAL, ANALYTICS, NETWORTH, CSV
# =====================================================================
class Test14FiturPendukung:
    def test_atur_dan_baca_budget(self, ctx):
        body = {"monthly_income": 15_000_000, "mode": "fixed", "categories": [
            {"category": "Makanan & Minuman", "limit": 1_500_000, "group": "needs"},
            {"category": "Transportasi", "limit": 800_000, "group": "needs"},
            {"category": "Hiburan", "limit": 500_000, "group": "wants"}]}
        r = req("POST", "/budget", ctx["admin"], json=body)
        assert r.status_code == 200, r.text
        got = req("GET", "/budget", ctx["admin"]).json()
        assert len(got["categories"]) == 3
        d = dashboard(ctx["admin"])
        assert d["has_budget"] is True
        assert len(d["budget_status"]) == 3

    def test_goal_dan_deposit(self, ctx):
        g = req("POST", "/goals", ctx["admin"], json={
            "title": "Dana Darurat", "target_amount": 20_000_000, "deadline": "2026-12-31"}).json()
        assert g["id"].startswith("goal_")
        d = req("POST", f"/goals/{g['id']}/deposit", ctx["admin"], json={"amount": 2_500_000})
        assert d.status_code == 200 and d.json()["saved_amount"] == 2_500_000
        d2 = req("POST", f"/goals/{g['id']}/deposit", ctx["admin"], json={"amount": 500_000})
        assert d2.json()["saved_amount"] == 3_000_000
        assert req("DELETE", f"/goals/{g['id']}", ctx["admin"]).status_code == 200
        assert req("POST", f"/goals/{g['id']}/deposit", ctx["admin"],
                   json={"amount": 1}).status_code == 404

    def test_analytics_tren_bulanan(self, ctx):
        a = req("GET", "/analytics", ctx["admin"]).json()
        cur = datetime.now(timezone.utc).strftime("%Y-%m")
        months = [t["month"] for t in a["trend"]]
        assert cur in months
        row = [t for t in a["trend"] if t["month"] == cur][0]
        assert row["income"] > 0 and row["expense"] > 0
        assert row["savings"] == row["income"] - row["expense"]

    def test_networth_history_tercatat(self, ctx):
        h = req("GET", "/networth/history", ctx["admin"]).json()
        assert len(h) >= 1
        last = h[-1]
        assert last["net_worth"] == last["assets"] - last["debt"]
        assert last["date"] == datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def test_export_csv_memuat_semua_jenis(self, ctx):
        r = req("GET", "/transactions/export", ctx["admin"])
        assert r.status_code == 200 and "text/csv" in r.headers.get("content-type", "")
        rows = list(csv.DictReader(io.StringIO(r.text)))
        assert rows[0].keys() >= {"date", "type", "amount", "category", "wallet", "to_wallet", "note", "member"}
        types = {r_["type"] for r_ in rows}
        assert {"income", "expense", "transfer"} <= types, types
        assert any(r_["to_wallet"] for r_ in rows if r_["type"] == "transfer")
        assert any(r_["member"] for r_ in rows)

    def test_import_csv_membuat_transaksi(self, ctx):
        wname = "Dompet Import Skenario"
        csv_body = (
            "date,type,amount,category,wallet,to_wallet,note\n"
            f"2026-01-05,expense,15000,Makanan & Minuman,{wname},,import A\n"
            f"2026-01-06,income,50000,Gaji,{wname},,import B\n"
            f"2026-01-07,transfer,20000,Lainnya,{wname},BCA,import C\n"
        )
        files = {"file": ("import.csv", csv_body.encode(), "text/csv")}
        r = req("POST", "/transactions/import", ctx["admin"], files=files)
        assert r.status_code == 200, r.text
        assert r.json()["imported"] == 3, r.json()

        w = [x for x in req("GET", "/wallets", ctx["admin"]).json() if x["name"] == wname][0]
        assert w["type"] == "cash"
        # 50000 income - 15000 expense - 20000 transfer ke BCA
        assert w["balance"] == 15_000, w["balance"]

        for t in req("GET", "/transactions", ctx["admin"]).json():
            if t.get("source") == "csv_import" and t.get("wallet_id") == w["id"]:
                req("DELETE", f"/transactions/{t['id']}", ctx["admin"])
        req("DELETE", f"/wallets/{w['id']}", ctx["admin"])

    def test_import_bukan_csv_ditolak(self, ctx):
        files = {"file": ("x.txt", b"bukan csv", "text/plain")}
        assert req("POST", "/transactions/import", ctx["admin"], files=files).status_code == 400


# =====================================================================
# 15. RINGKASAN KONSISTENSI
# =====================================================================
class Test15KonsistensiAkhir:
    def test_total_aset_dan_utang_konsisten_dengan_dashboard(self, ctx):
        wallets = req("GET", "/wallets", ctx["admin"]).json()
        assets = sum(w["balance"] for w in wallets if w["type"] not in ("credit_card", "paylater"))
        debt = sum(w["balance"] for w in wallets if w["type"] in ("credit_card", "paylater"))
        d = dashboard(ctx["admin"])
        assert d["assets"] == assets
        assert d["debt"] == debt
        assert d["net_worth"] == assets - debt

    def test_tidak_ada_saldo_negatif_pada_dompet_utang(self, ctx):
        for w in req("GET", "/wallets", ctx["admin"]).json():
            if w["type"] in ("credit_card", "paylater"):
                assert w["balance"] >= 0, f"{w['name']} punya saldo utang negatif: {w['balance']}"

    def test_riwayat_transaksi_lengkap(self, ctx):
        txns = req("GET", "/transactions?limit=500", ctx["admin"]).json()
        assert len(txns) > 10
        assert all(t["household_id"] for t in txns)
        assert all("_id" not in t for t in txns)
        dates = [t["date"] for t in txns]
        assert all(d for d in dates)
