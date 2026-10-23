# Tumara — Technical Architecture & Engineering Documentation 📊🤖

> **Tumbuh dengan arah. Pegang kendali penuh.**  
> Platform manajemen finansial pribadi & keluarga berbasis AI untuk Indonesia (Bahasa Indonesia · IDR · PWA Installable).  
> Model bisnis Sekali Bayar untuk Lisensi Seumur Hidup (Lifetime License), 100% bebas iklan dan pelacak komersial.

---

## 1. Ikhtisar Sistem & Fitur Utama

| Area / Modul | Fitur | Keterangan & Aturan Bisnis |
|---|---|---|
| **Dashboard** | Net Worth Real-Time, Financial Health Score (0–100), Daily Spend Pulse, Quick Action Chips, Mini Budget Widget | Health score dihitung objektif dari 4 pilar akuntansi (Solvabilitas, Tabungan, Disiplin 50/30/20, dan Target Goals). |
| **Wallets** | Multi-wallet: Rekening Bank, E-Wallet, Kartu Kredit, PayLater, Kas Tunai, Investasi | Saldo kartu kredit/paylater diperlakukan sebagai liabilitas/utang (`ledger.py`), mutasi transaksi otomatis memperbarui net worth. |
| **Transaksi** | Income, Expense, Transfer antar dompet dengan rollback otomatis saat diedit/dihapus | Setiap transaksi diatribusikan ke anggota keluarga (`member_id`), mendukung split transaksi itemized dari struk belanja. |
| **Smart AI OCR Scanner** | Ekstraksi foto struk belanja fisik ke rincian per-item, nominal, diskon, dan kategori | Menggunakan Google Gemini Vision dengan domain-aware prompt yang membedakan Belanja Kebutuhan Pokok (*Groceries*) vs Kuliner/Lifestyle. |
| **Natural Language Input** | Input teks santai (*"makan siang soto 35rb pake gopay"*) | AI otomatis memetakan nominal, kategori, dan dompet yang sesuai dengan konfirmasi modal sebelum disimpan. |
| **AI Personal CFO Advisor** | Chat interaktif finansial berbasis data riil portofolio | Memberikan rekomendasi pengetatan pos pengeluaran dan evaluasi arus kas bulanan secara streaming dengan tipografi markdown terstruktur. |
| **Weekly AI Health Recap** | Rangkuman naratif mingguan otomatis | Mengevaluasi tren belanja, tabungan, dan kepatuhan anggaran dalam 7 hari terakhir. |
| **Smart Budgeting 50/30/20** | Wizard alokasi Kebutuhan (50%), Keinginan (30%), dan Tabungan/Investasi (20%) | Dilengkapi fitur tambah kategori custom dinamis, safe deletion guardrails, inline salary edits, dan auto-balance 1-klik. |
| **Target Goals** | Target dana darurat, liburan, DP rumah, dll. | Dilengkapi visualisasi progres setoran, deadline, dan simulasi kebutuhan cicilan tabungan bulanan. |
| **Kalender Tagihan** | Tagihan berulang dengan visualisasi monthly heatmap calendar | Notifikasi jatuh tempo (*due soon*), tombol pelunasan (*mark-as-paid*) yang otomatis mencatat transaksi pengeluaran. |
| **Couple Finance Center** | Multi-user household (Admin + Partner) | Net worth bersama, filter transaksi per anggota, kalkulator split pengeluaran 50/50 atau proporsional pendapatan (*fair share*). |
| **Dual-Mode Checkout & Lisensi** | Funnel pembelian paket lisensi (Starter, Pro, Family) | Mendukung integrasi Midtrans Snap untuk live production, dan Mode Simulasi Instan (Sandbox Demo) untuk pengujian mandiri tanpa akun payment gateway. |

---

## 2. Tech Stack & Dependensi

### Frontend
- **Framework:** React 18 (Create React App SPA)
- **Routing:** React Router v6
- **Styling:** Tailwind CSS v3 dengan dark obsidian theme & emerald mint accent (`#10b981`)
- **Visualisasi & Animasi:** Recharts (Area, Donut, Bar Charts), Framer Motion, Lucide Icons
- **Notifikasi & Utilitas:** Sonner (Toast alerts), Axios (API client dengan retry otomatis saat backend cold-start)
- **Mobile/PWA:** Web App Manifest, Service Worker offline caching (production only), responsive mobile viewport

### Backend
- **Framework:** FastAPI (Python 3.10+ / 3.12+)
- **Server:** Uvicorn ASGI
- **Database Driver:** Motor (Async MongoDB Driver)
- **Data Validation:** Pydantic v2
- **Keamanan:** Bcrypt (salted password hashing), HTTP-Only secure cookies
- **AI Vision & LLM:** Google Gemini (`gemini-3.8-flash` via official `google-genai` / `google-generativeai`)
- **Image Processing:** Pillow (Receipt resizing, rotation, optimization)

### Database
- **Engine:** MongoDB Atlas (Production Cluster) / Local MongoDB
- **Database Name:** `fincfo_db`

---

## 3. Skema Data (Koleksi MongoDB Utama)

Semua dokumen MongoDB disimpan dengan string UUID terstruktur (`wal_`, `txn_`, `bill_`, `goal_`, `hh_`, `user_`, `ac_`, `ord_`) dan selalu diproyeksikan dengan `{"_id": 0}`.

1. **`users`**:
   - `user_id`, `email`, `name`, `password_hash`, `household_id`, `role` (`admin` / `partner`), `tier` (`starter` / `pro` / `family`), `onboarded`, `ai_usage`, `picture`, `created_at`.
2. **`user_sessions`**:
   - `session_token`, `user_id`, `expires_at`, `created_at`.
3. **`households`**:
   - `id`, `name`, `owner_user_id`, `created_at`.
4. **`wallets`**:
   - `id`, `household_id`, `user_id`, `name`, `type` (`bank` / `ewallet` / `credit_card` / `paylater` / `cash` / `investment`), `balance`, `currency`, `created_at`.
5. **`transactions`**:
   - `id`, `household_id`, `member_id`, `type` (`income` / `expense` / `transfer`), `amount`, `category`, `wallet_id`, `to_wallet_id`, `date`, `note`, `items`, `created_at`.
6. **`budgets`**:
   - `id`, `household_id`, `monthly_income`, `categories` (array kategori dan alokasi nominal), `updated_at`.
7. **`goals`**:
   - `id`, `household_id`, `name`, `target_amount`, `current_amount`, `target_date`, `wallet_id`, `icon`, `created_at`.
8. **`bills`**:
   - `id`, `household_id`, `title`, `amount`, `category`, `due_date`, `frequency` (`monthly` / `yearly` / `once`), `wallet_id`, `auto_record`, `status`, `created_at`.
9. **`orders`**:
   - `order_id`, `tier`, `amount`, `name`, `email`, `whatsapp`, `status` (`pending` / `paid` / `failed`), `payment_method`, `access_code`, `mode` (`simulation` / `midtrans`), `created_at`, `paid_at`.
10. **`access_codes`**:
    - `id`, `code` (`TMR-STR-XXXXXX`, `TMR-PRO-XXXXXX`, `TMR-FAM-XXXXXX`), `tier`, `active`, `max_uses`, `used_count`, `created_at`.

---

## 4. API Reference Ringkas

Semua rute backend di-mount di bawah prefix `/api`.

### Autentikasi & Akun (`/api/auth`)
- `POST /auth/register`: Mendaftar akun baru dengan email, password, dan kode lisensi pendaftaran / kode undangan keluarga.
- `POST /auth/login`: Masuk dengan email & password.
- `POST /auth/logout`: Menghapus sesi aktif.
- `GET /auth/me`: Mengambil profil pengguna terautentikasi dan data household.
- `POST /auth/forgot-password`: Mengirim kode pemulihan password.
- `POST /auth/reset-password`: Memperbarui password menggunakan token reset.

### Order & Pembayaran (`/api/orders`)
- `POST /orders/checkout`: Membuat pesanan lisensi baru.
- `POST /orders/simulate-pay`: Mensimulasikan pembayaran lunas instan (Sandbox Demo) dan meng-generate kode lisensi unik.
- `GET /orders/{order_id}/status`: Polling status pesanan dan kode lisensi.
- `POST /orders/webhook/midtrans`: Webhook resmi dari Midtrans untuk verifikasi pembayaran real-time.

### Keuangan & Dompet (`/api`)
- `GET /wallets` & `POST /wallets`: Mengambil dan menambah dompet.
- `PUT /wallets/{id}` & `DELETE /wallets/{id}`: Edit dan hapus dompet.
- `GET /transactions` & `POST /transactions`: Riwayat dan input transaksi baru.
- `PUT /transactions/{id}` & `DELETE /transactions/{id}`: Edit dan hapus transaksi dengan pembalikan saldo otomatis.
- `GET /budget` & `POST /budget`: Data budget 50/30/20 dan pembaruan alokasi.
- `GET /goals` & `POST /goals`: Target tabungan finansial.
- `GET /bills` & `POST /bills`: Kalender tagihan dan pelunasan.
- `GET /networth/history`: Riwayat snapshot net worth bulanan.
- `GET /dashboard/summary`: Agregasi ringkasan dashboard, health score, dan spend pulse.

### Fitur AI Cloud (`/api/ai`)
- `POST /ai/chat/stream`: Server-Sent Events (SSE) streaming respons AI Financial Advisor.
- `POST /ai/parse-transaction`: Memetakan kalimat teks bebas ke format transaksi terstruktur.
- `POST /ai/scan-receipt`: Ekstraksi itemized receipt OCR dari foto struk belanja fisik.
- `GET /ai/weekly-recap`: Rangkuman evaluasi kesehatan finansial mingguan.

---

## 5. Menjalankan Sistem Secara Mandiri

### File Environment (`backend/.env`)
```ini
MONGO_URL=mongodb+srv://<user>:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority
DB_NAME=fincfo_db
GEMINI_API_KEY=AIzaSy...
CORS_ORIGINS=https://tumara.id,https://tumara-v2.vercel.app,http://localhost:3000
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx  # Opsional: kosongkan untuk mode simulasi demo
```

### File Environment (`frontend/.env`)
```ini
REACT_APP_BACKEND_URL=https://tumara-backend.onrender.com
# REACT_APP_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx # Opsional untuk Midtrans live
```

---

_Tumara © 2026 — Tumbuh dengan arah._
