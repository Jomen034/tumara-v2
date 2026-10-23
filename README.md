# Tumara — Personal AI Finance CFO 📊🤖

> **Tumbuh dengan arah. Pegang kendali penuh.**  
> Platform manajemen finansial pribadi & keluarga berbasis AI untuk Indonesia (Bahasa Indonesia · IDR · PWA Installable).  
> Sekali bayar untuk lisensi seumur hidup (Lifetime License), 100% bebas iklan dan pelacak komersial pihak ketiga.

---

## 🌟 Fitur Utama (Highlights)

- 🏦 **Multi-Wallet & Real-Time Net Worth**: Pantau saldo rekening bank, e-wallet, kartu kredit, paylater, hingga investasi dalam satu kendali portofolio terpadu.
- 🤖 **Personal AI Financial Advisor**: Konsultasi kondisi keuangan interaktif berbasis data riil dompet pengguna, bukan rekomendasi generik.
- 🧾 **Smart OCR Receipt Scanner**: Cukup foto struk belanja fisik Anda; AI mengekstrak nama item, kuantitas, harga, diskon, hingga kategori belanja.
- 💬 **Natural Language Quick Input**: Catat transaksi cukup dengan mengetik santai (*"makan siang soto 35rb pake gopay"*).
- 📊 **Smart Budgeting 50/30/20 & Daily Spend Pulse**: Panduan disiplin alokasi kebutuhan, keinginan, dan tabungan harian agar tidak boncos sebelum akhir bulan.
- 🎯 **Target Finansial Terukur (Goals)**: Simulasi dana darurat, liburan, hingga DP rumah dengan progres setoran otomatis.
- 📅 **Kalender Tagihan & Monthly Heatmap**: Peringatan jatuh tempo tagihan berulang dengan visualisasi kepadatan tanggal.
- 👥 **Couple Finance Center (Family Sharing)**: Pengelolaan keuangan bersama pasangan (suami-istri/partner) dengan kalkulator split tagihan 50/50 atau proporsional penghasilan.
- 💳 **Dual-Mode Checkout & Lisensi Otomatis**: Alur pembelian paket (Starter, Pro, Family) dengan generator kode lisensi instan (`TMR-STR-`, `TMR-PRO-`, `TMR-FAM-`) dan auto-registration onboarding.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, React Router v6, Tailwind CSS v3, Framer Motion, Recharts, Lucide Icons, Sonner.
- **Backend:** FastAPI (Python 3.10+ / 3.12+), Uvicorn, Motor (Async MongoDB), Pydantic v2, Bcrypt, Pillow.
- **Database:** MongoDB Atlas (Production) / Local MongoDB (`fincfo_db`).
- **Cloud AI:** Google Gemini (`gemini-3.8-flash` via official `google-genai` / `google-generativeai`).
- **Payment Engine:** Dual-Mode Order Engine (Mode Simulasi Demo + Midtrans Snap Ready).

---

## 🚀 Quick Start (Local Development)

### 1. Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Pastikan file backend/.env sudah terkonfigurasi:
# MONGO_URL=mongodb://localhost:27017
# DB_NAME=fincfo_db
# GEMINI_API_KEY=AIzaSy...
# CORS_ORIGINS=http://localhost:3000

uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
# Pastikan frontend/.env:
# REACT_APP_BACKEND_URL=http://localhost:8001

npm start
```
Buka browser di `http://localhost:3000`.

---

## 📂 Struktur Repositori

```
tumara-v2/
├── backend/
│   ├── server.py              # FastAPI app & router mounting (/api)
│   ├── auth.py                # Autentikasi email/password (bcrypt) & session
│   ├── routes_orders.py       # Engine checkout, generate kode lisensi, dan webhook
│   ├── routes_finance.py      # Dompet, transaksi, budget, goals, laporan, net worth
│   ├── routes_ai.py           # Streaming chat advisor & text parsing
│   ├── routes_bills.py        # Kalender tagihan & habit tracker
│   ├── routes_household.py    # Family sharing & couple finance split
│   ├── ai_service.py          # Gemini AI integration (OCR, advisor, recap)
│   ├── ai_quota.py            # AI Fair Usage Policy (FUP) & quota tracking
│   └── ledger.py              # Engine saldo akuntansi: aset vs utang
├── frontend/
│   ├── src/pages/             # Landing, Dashboard, Wallets, Transactions, Budget, Goals, Advisor, Reports, Bills, Household, Onboarding
│   ├── src/components/        # CheckoutModal, TransactionDetailModal, Layout, TumaraLogo, UI Primitives
│   └── public/                # PWA manifest, service worker, icons
├── GO_TO_MARKET_CHECKLIST.md  # Panduan persiapan peluncuran produk ke pasar
├── PROJECT_DOCUMENTATION.md   # Dokumentasi teknis lengkap arsitektur sistem
└── PROGRESS_LOG.md            # Ledger catatan pembaruan & pengembangan sistem
```

---

_Tumara © 2026 — Tumbuh dengan arah._
