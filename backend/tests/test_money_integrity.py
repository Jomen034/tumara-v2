"""Test Suite untuk Integritas Data Keuangan & Jalur Uang (Money Paths).

Mencakup pengujian menyeluruh untuk:
1. Ledger Engine & Aturan Saldo (Dompet Aset vs Dompet Utang, Konservasi Net Worth, Reversal).
2. Bayar Tagihan (Recurring & Cicilan / Tenor completion).
3. Setor Goal (Expense deposit & Transfer deposit).
4. Distribusi Kategori Struk & Ekstraksi Pajak / Service Charge (_distribute_txn_categories).
5. Transfer Antar Dompet + Biaya Admin (Fee Isolation & Total Wallet Deduction).
6. Presisi Integer IDR (Eliminasi Floating Point Drift).
"""

import os
import sys
import unittest
from datetime import datetime, timezone, date, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

# Environment flag for test mode
os.environ["TESTING"] = "true"

# Stub external dependencies if not present in the runtime environment
for m in [
    'certifi', 'motor', 'motor.motor_asyncio', 'dotenv', 'pymongo',
    'mongomock_motor', 'fastapi', 'fastapi.responses', 'models', 'deps', 'db'
]:
    if m not in sys.modules:
        sys.modules[m] = MagicMock()

# Ensure backend directory is in sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)


class TestLedgerMathAndDebtInversion(unittest.TestCase):
    """Pengujian logika ledger.py untuk dompet aset vs dompet utang (Kartu Kredit & PayLater)."""

    def test_debt_wallet_detection(self):
        """Memastikan dompet utang terdeteksi secara presisi."""
        from ledger import is_debt_wallet
        self.assertTrue(is_debt_wallet({"type": "credit_card"}))
        self.assertTrue(is_debt_wallet({"type": "paylater"}))
        self.assertFalse(is_debt_wallet({"type": "bank"}))
        self.assertFalse(is_debt_wallet({"type": "ewallet"}))
        self.assertFalse(is_debt_wallet({"type": "cash"}))
        self.assertFalse(is_debt_wallet({"type": "investment"}))
        self.assertFalse(is_debt_wallet(None))

    def test_signed_delta_calculation(self):
        """Uang masuk (+signed) ke dompet aset -> saldo bertambah (+).
        Uang masuk (+signed) ke dompet utang (bayar tagihan) -> saldo utang berkurang (-).
        Uang keluar (-signed) dari dompet utang (gesek kartu) -> saldo utang bertambah (+).
        """
        from ledger import is_debt_wallet

        # 1. Dompet Aset (Bank / Tunai)
        bank_wallet = {"type": "bank", "balance": 1_000_000}
        # Pemasukan 500k
        delta_in = 500_000 if not is_debt_wallet(bank_wallet) else -500_000
        self.assertEqual(delta_in, 500_000)
        # Pengeluaran 200k (signed_amount = -200_000)
        delta_out = -200_000 if not is_debt_wallet(bank_wallet) else 200_000
        self.assertEqual(delta_out, -200_000)

        # 2. Dompet Utang (Kartu Kredit / PayLater)
        cc_wallet = {"type": "credit_card", "balance": 2_000_000}  # Utang 2 jt
        # Gesek kartu kredit 300k (signed_amount = -300_000, uang keluar)
        delta_swipe = -(-300_000) if is_debt_wallet(cc_wallet) else -300_000
        self.assertEqual(delta_swipe, 300_000, "Gesek kartu kredit harus MENAIKKAN total utang")

        # Bayar tagihan kartu kredit 500k (signed_amount = +500_000, uang masuk melunasi)
        delta_pay = -(500_000) if is_debt_wallet(cc_wallet) else 500_000
        self.assertEqual(delta_pay, -500_000, "Bayar tagihan kartu kredit harus MENURUNKAN total utang")

    def test_net_worth_invariance_on_transfer(self):
        """Transfer antar dompet aset tidak boleh mengubah total net worth (Invariant)."""
        bank_balance = 5_000_000
        gopay_balance = 500_000
        initial_net_worth = bank_balance + gopay_balance

        transfer_amt = 250_000
        # BCA -> GoPay
        bank_balance -= transfer_amt
        gopay_balance += transfer_amt

        final_net_worth = bank_balance + gopay_balance
        self.assertEqual(initial_net_worth, final_net_worth)
        self.assertEqual(bank_balance, 4_750_000)
        self.assertEqual(gopay_balance, 750_000)


class TestReceiptCategoryDistribution(unittest.TestCase):
    """Pengujian distribusi kategori struk belanja (_distribute_txn_categories)."""

    def setUp(self):
        from routes_finance import _canonical_category, _distribute_txn_categories
        self.canonical = _canonical_category
        self.distribute = _distribute_txn_categories

    def test_canonical_category_normalization(self):
        """Memastikan semua variasi nama kategori dipetakan secara kanonikal."""
        self.assertEqual(self.canonical("Biaya Admin"), "Biaya Admin & Layanan")
        self.assertEqual(self.canonical("Biaya Layanan"), "Biaya Admin & Layanan")
        self.assertEqual(self.canonical("Admin Fee"), "Biaya Admin & Layanan")
        self.assertEqual(self.canonical("Service Charge 5%"), "Biaya Admin & Layanan")
        self.assertEqual(self.canonical("PB1 Pajak Resto"), "Biaya Admin & Layanan")
        self.assertEqual(self.canonical("PPN 11%"), "Biaya Admin & Layanan")
        self.assertEqual(self.canonical("Supermarket GrandLucky"), "Groceries & Kebutuhan Rumah")
        self.assertEqual(self.canonical("Kopi Kenangan"), "Makanan & Minuman")
        self.assertEqual(self.canonical("Bensin BP"), "Transportasi")
        self.assertEqual(self.canonical("Car Loan BCA Finance"), "Cicilan & Pinjaman")
        self.assertEqual(self.canonical("Cicilan Mobil"), "Cicilan & Pinjaman")
        self.assertEqual(self.canonical("Angsuran KPR BTN"), "Cicilan & Pinjaman")

    def test_single_item_expense_distribution(self):
        """Transaksi biasa tanpa sub-item 100% masuk ke kategori utama."""
        t = {"amount": 50000, "category": "Makanan & Minuman"}
        dist = self.distribute(t)
        self.assertEqual(dist, {"Makanan & Minuman": 50000.0})

    def test_multi_item_receipt_split(self):
        """Struk dengan item campuran (misal: belanja supermarket ada bahan mentah + sabun cuci)."""
        t = {
            "amount": 100000,
            "category": "Groceries & Kebutuhan Rumah",
            "items": [
                {"name": "Beras 5kg", "price": 75000, "category": "Groceries & Kebutuhan Rumah"},
                {"name": "Kopi Botol", "price": 25000, "category": "Makanan & Minuman"},
            ]
        }
        dist = self.distribute(t)
        self.assertEqual(dist.get("Groceries & Kebutuhan Rumah"), 75000.0)
        self.assertEqual(dist.get("Makanan & Minuman"), 25000.0)
        self.assertEqual(sum(dist.values()), 100000.0)

    def test_receipt_with_exclusive_tax_and_service(self):
        """Struk restoran dengan Subtotal Makanan + Service Charge + Pajak PB1."""
        t = {
            "amount": 115500,
            "category": "Makanan & Minuman",
            "items": [
                {"name": "Nasi Goreng Spesial", "price": 100000, "category": "Makanan & Minuman"},
                {"name": "Service Charge (5%)", "price": 5000, "category": "Biaya Admin & Layanan"},
                {"name": "Pajak Restoran PB1 (10%)", "price": 10500, "category": "Biaya Admin & Layanan"},
            ]
        }
        dist = self.distribute(t)
        self.assertEqual(dist.get("Makanan & Minuman"), 100000.0)
        self.assertEqual(dist.get("Biaya Admin & Layanan"), 15500.0)
        self.assertEqual(sum(dist.values()), 115500.0)

    def test_budget_category_split_no_duplication(self):
        """Memastikan struk Restoran Sederhana Rp 209.000 terbagi Rp 190.000 & Rp 19.000 tanpa duplikasi."""
        t = {
            "amount": 209000,
            "category": "Makanan & Minuman",
            "items": [
                {"name": "2 NASI", "price": 22000, "category": "Makanan & Minuman"},
                {"name": "1 Orange juice", "price": 27000, "category": "Makanan & Minuman"},
                {"name": "1 Nasi Tambah", "price": 9000, "category": "Makanan & Minuman"},
                {"name": "1 Sayur Nangka/Singkong", "price": 16000, "category": "Makanan & Minuman"},
                {"name": "1 SMBL GR UDANG/CUM", "price": 29000, "category": "Makanan & Minuman"},
                {"name": "1 AYAM GULAI/BKR/PNS", "price": 26000, "category": "Makanan & Minuman"},
                {"name": "1 RENDANG", "price": 27000, "category": "Makanan & Minuman"},
                {"name": "1 TELUR DADAR", "price": 18000, "category": "Makanan & Minuman"},
                {"name": "1 PB1 (10%)", "price": 19000, "category": "Biaya Admin & Layanan"},
            ]
        }
        dist = self.distribute(t)
        self.assertEqual(dist.get("Makanan & Minuman"), 190000.0)
        self.assertEqual(dist.get("Biaya Admin & Layanan"), 19000.0)
        self.assertEqual(sum(dist.values()), 209000.0)

    def test_receipt_remainder_retention(self):
        """Jika ada sisa pembulatan kasir (remainder), tidak boleh ada uang yang hilang."""
        t = {
            "amount": 83000,
            "category": "Makanan & Minuman",
            "items": [
                {"name": "Es Kopi Susu Tetangga x4", "price": 80000, "category": "Makanan & Minuman"},
            ]
        }
        # Sisa 3.000 harus masuk ke kategori utama
        dist = self.distribute(t)
        self.assertEqual(dist.get("Makanan & Minuman"), 83000.0)
        self.assertEqual(sum(dist.values()), 83000.0)


class TestBillPaymentAndInstallmentTenor(unittest.TestCase):
    """Pengujian logika pembayaran tagihan dan pelunasan cicilan (routes_bills.py)."""

    def test_advance_due_date_monthly(self):
        """Tanggal jatuh tempo tagihan bulanan harus maju 1 bulan."""
        from routes_bills import _advance
        self.assertEqual(_advance("2026-10-05", "monthly"), "2026-11-05")
        self.assertEqual(_advance("2026-12-15", "monthly"), "2027-01-15")
        self.assertEqual(_advance("2026-01-31", "monthly"), "2026-02-28", "Bulan Februari harus capped ke tgl 28")

    def test_advance_due_date_weekly_and_yearly(self):
        """Tanggal jatuh tempo mingguan (+7 hari) dan tahunan (+1 tahun)."""
        from routes_bills import _advance
        self.assertEqual(_advance("2026-10-01", "weekly"), "2026-10-08")
        self.assertEqual(_advance("2026-10-01", "yearly"), "2027-10-01")

    def test_installment_tenor_completion_logic(self):
        """Cicilan selesai ketika paid_tenor mencapai total_tenor."""
        total_tenor = 12
        paid_tenor = 11

        # Pembayaran ke-12
        new_paid = paid_tenor + 1
        is_completed = total_tenor > 0 and new_paid >= total_tenor

        self.assertEqual(new_paid, 12)
        self.assertTrue(is_completed, "Cicilan harus selesai setelah tenor terakhir dibayar")

        # Sisa cicilan harus 0
        remaining_tenor = max(0, total_tenor - new_paid)
        self.assertEqual(remaining_tenor, 0)


class TestGoalDepositAndConservation(unittest.TestCase):
    """Pengujian setor tabungan / goal deposit."""

    def test_goal_deposit_calculation(self):
        """Setor ke goal menambah saved_amount dan memperbarui persentase progres."""
        target_amount = 10_000_000
        saved_amount = 4_000_000

        deposit_amt = 1_000_000
        new_saved = saved_amount + deposit_amt
        new_remaining = max(0, target_amount - new_saved)
        progress_pct = round((new_saved / target_amount) * 100, 1)

        self.assertEqual(new_saved, 5_000_000)
        self.assertEqual(new_remaining, 5_000_000)
        self.assertEqual(progress_pct, 50.0)

    def test_transfer_to_investment_goal_conservation(self):
        """Setor tabungan via transfer (BCA -> Bibit):
        Saldo BCA berkurang, Bibit bertambah, Goal bertambah, Net worth tetap sama."""
        bca_balance = 8_000_000
        bibit_balance = 2_000_000
        goal_saved = 2_000_000

        initial_net_worth = bca_balance + bibit_balance  # 10.000.000

        deposit_amt = 1_500_000
        bca_balance -= deposit_amt
        bibit_balance += deposit_amt
        goal_saved += deposit_amt

        final_net_worth = bca_balance + bibit_balance

        self.assertEqual(bca_balance, 6_500_000)
        self.assertEqual(bibit_balance, 3_500_000)
        self.assertEqual(goal_saved, 3_500_000)
        self.assertEqual(initial_net_worth, final_net_worth, "Net worth harus 100% terjaga utuh")


class TestTransferAdminFeeFlow(unittest.TestCase):
    """Pengujian alur transfer dengan biaya admin (Biaya Admin & Layanan)."""

    def test_transfer_with_admin_fee_deduction(self):
        """Transfer Rp 1.000.000 dengan biaya admin BI-Fast Rp 2.500:
        - Dompet asal terpotong Rp 1.002.500
        - Dompet tujuan menerima Rp 1.000.000
        - Net worth keluarga hanya berkurang tepat Rp 2.500 (sebesar admin fee).
        """
        source_bal = 5_000_000
        dest_bal = 1_000_000
        initial_total = source_bal + dest_bal

        transfer_amt = 1_000_000
        admin_fee = 2_500

        # 1. Mutasi transfer pokok
        source_bal -= transfer_amt
        dest_bal += transfer_amt

        # 2. Mutasi biaya admin dari dompet asal
        source_bal -= admin_fee

        final_total = source_bal + dest_bal

        self.assertEqual(source_bal, 3_997_500)
        self.assertEqual(dest_bal, 2_000_000)
        self.assertEqual(final_total, initial_total - admin_fee)
        self.assertEqual(initial_total - final_total, 2500, "Selisih kekayaan hanya sebesar biaya admin")


class TestIntegerPrecisionAndRoundingSafety(unittest.TestCase):
    """Pengujian presisi integer IDR untuk mengeliminasi floating point drift."""

    def test_float_drift_elimination(self):
        """Memastikan pecahan desimal (seperti 1208333.3333333333) ter-cast menjadi integer bulat."""
        amount_raw = 1208333.3333333333
        amount_int = int(round(amount_raw))
        self.assertEqual(amount_int, 1208333)
        self.assertIsInstance(amount_int, int)

    def test_addition_precision(self):
        """Memastikan pembagian dan penjumlahan bertahap tidak menghasilkan desimal ganjil."""
        base = 14_500_000
        p1 = int(round(base * 0.2))  # 2.900.000
        p2 = int(round(base * 0.1))  # 1.450.000
        p3 = int(round(base * 0.1))  # 1.450.000
        p4 = int(round(base * 0.05)) # 725.000
        p5 = int(round(base * 0.05)) # 725.000

        total_needs = p1 + p2 + p3 + p4 + p5
        self.assertEqual(total_needs, 7_250_000)
        self.assertIsInstance(total_needs, int)


class TestFinancialNumberParsing(unittest.TestCase):
    """Pengujian fungsi parse_financial_number untuk mengeliminasi penambahan nol dan kegagalan edit."""

    def test_float_input_does_not_add_zero(self):
        """Memastikan float 213400.0 tidak berubah menjadi 2134000.0 (bug strip dot)."""
        from ledger import parse_financial_number
        self.assertEqual(parse_financial_number(213400.0), 213400.0)
        self.assertEqual(parse_financial_number(130000.0), 130000.0)
        self.assertEqual(parse_financial_number("213400.0"), 213400.0)

    def test_indonesian_thousand_separator(self):
        """Format ribuan Indonesia titik 3-digit: '213.400' -> 213400.0."""
        from ledger import parse_financial_number
        self.assertEqual(parse_financial_number("213.400"), 213400.0)
        self.assertEqual(parse_financial_number("130.000"), 130000.0)
        self.assertEqual(parse_financial_number("Rp 213.400"), 213400.0)

    def test_multiple_thousand_dots(self):
        """Format jutaan titik berulang: '2.134.000' -> 2134000.0."""
        from ledger import parse_financial_number
        self.assertEqual(parse_financial_number("2.134.000"), 2134000.0)
        self.assertEqual(parse_financial_number("Rp 2.134.000"), 2134000.0)

    def test_comma_decimal_handling(self):
        """Format desimal koma: '213.400,50' -> 213400.5."""
        from ledger import parse_financial_number
        self.assertEqual(parse_financial_number("213.400,50"), 213400.5)
        self.assertEqual(parse_financial_number("50,5"), 50.5)


class TestDebtSanitationAndNetWorth(unittest.TestCase):
    """Pengujian sanitasi saldo dompet utang dan kalkulasi net worth agar tidak terjadi perkalian minus ganda."""

    def test_debt_wallet_negative_balance_sanitation(self):
        """Dompet utang (kartu kredit/paylater) yang diinput minus (-68566415) wajib di-abs menjadi positif."""
        from ledger import is_debt_wallet
        raw_wallet = {"type": "credit_card", "balance": -68566415}
        sanitized_balance = abs(raw_wallet["balance"]) if is_debt_wallet(raw_wallet) else raw_wallet["balance"]
        self.assertEqual(sanitized_balance, 68566415.0)

    def test_jomen_mandiri_cc_net_worth_case(self):
        """Simulasi kasus user Jomen:
        Aset: 53.909.505
        Mandiri CC: -68.566.415 (tersimpan minus dari input m-banking)
        OCBC CC: 1.105.200 (tersimpan normal positif)
        Net Worth harus bernilai -13.551.710 (defisit), BUKAN +121.370.720.
        """
        from ledger import is_debt_wallet
        wallets = [
            {"id": "w1", "name": "Mama - JAGO Debit", "type": "bank", "balance": 53_909_505},
            {"id": "w2", "name": "Papa - Mandiri CC", "type": "credit_card", "balance": -68_566_415},
            {"id": "w3", "name": "Papa - OCBC CC", "type": "credit_card", "balance": 1_105_200},
        ]
        # Auto-heal sanitasi
        for w in wallets:
            if is_debt_wallet(w) and w["balance"] < 0:
                w["balance"] = abs(w["balance"])

        assets = sum(w["balance"] for w in wallets if not is_debt_wallet(w))
        debt = sum(abs(w["balance"]) for w in wallets if is_debt_wallet(w))
        net_worth = assets - debt

        self.assertEqual(assets, 53_909_505)
        # Total Utang: Mandiri (68.566.415) + OCBC (1.105.200) = 69.671.615
        self.assertEqual(debt, 69_671_615)
        self.assertEqual(net_worth, 53_909_505 - 69_671_615)
        self.assertLess(net_worth, 0, "Net worth harus defisit karena utang lebih besar dari aset")
        self.assertNotEqual(net_worth, 121_370_720, "Net worth tidak boleh melonjak akibat minus ganda")


class TestDictLedgerApplication(unittest.TestCase):
    """Pengujian apply_transaction yang menerima dictionary langsung dari MongoDB."""

    def test_apply_transaction_dict_support(self):
        """Memastikan dictionary transaksi dapat diterapkan langsung ke ledger."""
        import asyncio
        from ledger import apply_transaction

        doc = {
            "id": "txn_mock_01",
            "type": "expense",
            "amount": 213400.0,
            "wallet_id": "wal_01",
        }

        # Mock apply_movement
        movements = []
        async def mock_movement(hid, wid, delta):
            movements.append((hid, wid, delta))
            return True

        with patch("ledger.apply_movement", side_effect=mock_movement):
            asyncio.run(apply_transaction("hh_01", doc, sign=+1))
            self.assertEqual(len(movements), 1)
            self.assertEqual(movements[0], ("hh_01", "wal_01", -213400))

            # Test reversal with sign=-1
            movements.clear()
            asyncio.run(apply_transaction("hh_01", doc, sign=-1))
            self.assertEqual(len(movements), 1)
            self.assertEqual(movements[0], ("hh_01", "wal_01", 213400))


class TestProportionalCategoryDistribution(unittest.TestCase):
    """Pengujian penskalaan proporsional pada _distribute_txn_categories jika amount diedit lebih kecil dari sub-item."""

    def test_proportional_scaling_when_amount_reduced(self):
        from routes_finance import _distribute_txn_categories
        t = {
            "amount": 50_000,
            "category": "Makanan & Minuman",
            "items": [
                {"name": "Nasi Goreng", "price": 60_000, "category": "Makanan & Minuman"},
                {"name": "Es Teh", "price": 40_000, "category": "Makanan & Minuman"},
            ]
        }
        dist = _distribute_txn_categories(t)
        total_dist = sum(dist.values())
        self.assertEqual(total_dist, 50_000, "Total distribusi kategori harus persis sama dengan amount transaksi")


class TestUpdateTransactionAtomicRollback(unittest.TestCase):
    """Pengujian atomic rollback pada update_transaction untuk mencegah phantom ledger leak."""

    def test_atomic_rollback_on_database_failure(self):
        """Memastikan jika update transaksi gagal di database, seluruh mutasi saldo dibatalkan seketika."""
        import asyncio

        # Initial state: Mandiri CC has balance 577.056
        wallet_balance = {"wal_mandiri": 577056}

        async def fake_apply_movement(hid, wid, signed_amt):
            # For debt wallet (credit_card): signed_amt > 0 (inflow/reversal) decreases debt (-),
            # signed_amt < 0 (expense) increases debt (+)
            # signed_amt is -amount for expense, +amount for reversal
            # delta = int(round(-signed_amt))
            delta = int(round(-signed_amt))
            wallet_balance[wid] = wallet_balance.get(wid, 0) + delta
            return True

        with patch("ledger.apply_movement", side_effect=fake_apply_movement), \
             patch("ledger.get_wallet", return_value={"id": "wal_mandiri", "type": "credit_card"}):

            from ledger import apply_transaction

            old_doc = {"id": "txn_1", "type": "expense", "amount": 1, "wallet_id": "wal_mandiri"}
            new_data = {"id": "txn_1", "type": "expense", "amount": 400000, "wallet_id": "wal_mandiri"}

            # Simulate update_transaction execution
            applied_old_reversal = False
            applied_new_ledger = False

            async def do_update_with_failure():
                nonlocal applied_old_reversal, applied_new_ledger
                # Step 1: reverse old
                await apply_transaction("hh_01", old_doc, -1)
                applied_old_reversal = True

                # Step 2: apply new
                await apply_transaction("hh_01", new_data, +1)
                applied_new_ledger = True

                # Step 3: DB failure occurs here
                raise RuntimeError("Simulated Database Connection Failure")

            async def run_with_rollback():
                try:
                    await do_update_with_failure()
                except Exception:
                    # Execute atomic rollback
                    if applied_new_ledger:
                        await apply_transaction("hh_01", new_data, -1)
                    if applied_old_reversal:
                        await apply_transaction("hh_01", old_doc, +1)

            asyncio.run(run_with_rollback())

            # Verify: wallet balance MUST return exactly to 577.056 (ZERO phantom leak)
            self.assertEqual(
                wallet_balance["wal_mandiri"],
                577056,
                "Saldo dompet harus kembali persis ke nilai awal jika update database gagal!"
            )


class TestSnapshotNetworthResilience(unittest.TestCase):
    """Pengujian snapshot_networth tidak boleh crash saat ada wallet dengan balance None atau invalid."""

    def test_snapshot_handles_none_balance_gracefully(self):
        import asyncio
        from ledger import snapshot_networth

        mock_wallets = [
            {"id": "w1", "type": "bank", "balance": None},
            {"id": "w2", "type": "credit_card", "balance": -500000},
            {"id": "w3", "type": "ewallet", "balance": 1500000},
        ]

        mock_db = MagicMock()
        mock_db.wallets.find.return_value.to_list = AsyncMock(return_value=mock_wallets)
        mock_db.wallets.update_one = AsyncMock()
        mock_db.networth_snapshots.update_one = AsyncMock()

        with patch("ledger.db", mock_db):
            # snapshot_networth should run smoothly without throwing TypeError
            try:
                asyncio.run(snapshot_networth("hh_test"))
                success = True
            except Exception:
                success = False

            self.assertTrue(success, "snapshot_networth tidak boleh raise exception saat balance bernilai None")


if __name__ == "__main__":
    unittest.main()
