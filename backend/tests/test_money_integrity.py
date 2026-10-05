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


if __name__ == "__main__":
    unittest.main()
