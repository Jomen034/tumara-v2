# Nusa (Tumara v2) — AI Agent Guidelines & Architecture Manual

This file serves as the definitive onboarding guide for AI agents (GitHub Copilot, Claude Code, Cline, Roo Code, Cursor, etc.) working on this repository.

---

## 1. Project Overview & Architecture

**Nusa** is an AI-powered personal finance management app (Bahasa Indonesia · IDR · PWA) built with:
- **Frontend:** React 18 (SPA), Tailwind CSS, Framer Motion, Recharts, Lucide Icons, Axios.
- **Backend:** FastAPI (Python 3.9+ / 3.10+), Uvicorn, Motor (Async MongoDB), Pydantic v2.
- **Database:** MongoDB (Local or MongoDB Atlas) — Database name: `fincfo_db`.
- **AI Service:** Google Gemini (`gemini-3.6-flash` via `google-generativeai`) with graceful local fallback and legacy `emergentintegrations` support.

---

## 2. Core Operational Rules (Non-Negotiable)

1. **Progress Logging Rule:**
   - Whenever an agent performs meaningful tasks, architecture changes, refactoring, or fixes, it **MUST insert an entry at the TOP of `PROGRESS_LOG.md` (under "Progress Entries")** in reverse-chronological order following the established format with **Jakarta Time (WIB / UTC+7)** (Date/Timestamp in `YYYY-MM-DD HH:MM:SS WIB`, Title, Agent & Model name, Key Points + Explanation, Notes/Important things).
2. **API Prefix:**
   - Every backend endpoint **MUST** be mounted under `/api` in `backend/server.py`.
   - Frontend calls `process.env.REACT_APP_BACKEND_URL + "/api"` (via the axios helper in `frontend/src/lib/api.js`).
3. **Multi-Tenant & Household Scoping:**
   - Financial records (wallets, transactions, budgets, goals, bills) belong to a `household_id`.
   - Backend routes must resolve context with `ctx: Ctx = Depends(get_ctx)` from `backend/deps.py` and query `{ "household_id": ctx.hid }`.
   - Transactions must record `member_id = ctx.user.user_id` for attribution.
4. **MongoDB Document Hygiene:**
   - Always project `{"_id": 0}` when querying collections to prevent BSON ObjectId serialization issues.
   - IDs are string-prefixed UUIDs: `wal_`, `txn_`, `bill_`, `goal_`, `hh_`, `inv_`, `user_`, `msg_`.
   - Timestamp standard: UTC ISO-8601 strings or `datetime.now(timezone.utc)`.
5. **UI & Language Standards:**
   - Default UI language is **Bahasa Indonesia**.
   - Currency format is **IDR** (e.g., `Rp 1.500.000` via helper in `frontend/src/lib/format.js`).
   - Interactive UI elements must maintain `data-testid` attributes.
   - Call `useRefresh().bump()` after financial mutations to trigger cross-screen reactive updates.

---

## 3. Directory Layout

```
├── backend/
│   ├── server.py              # FastAPI application entry point, CORS & router mounting
│   ├── auth.py                # Standalone Dev Auth & Google OAuth session management
│   ├── db.py                  # Motor async MongoDB client initialization
│   ├── deps.py                # Dependency injection & household context resolver (Ctx)
│   ├── models.py              # Pydantic data models & schema definitions
│   ├── ai_service.py          # Gemini AI (advisor stream, text parsing, receipt OCR, weekly recap)
│   ├── routes_finance.py      # Wallets, transactions, budgets, goals, reports, CSV export/import
│   ├── routes_household.py    # Household invites, members, role management
│   ├── routes_bills.py        # Bill reminders & recurring payments
│   ├── routes_ai.py           # AI streaming chat & transaction parse endpoints
│   └── tests/                 # Pytest backend test suites
├── frontend/
│   ├── src/
│   │   ├── App.js             # React Router routing & global shell
│   │   ├── context/           # AuthContext, RefreshContext, ThemeContext
│   │   ├── lib/               # api.js (Axios), constants.js, format.js
│   │   ├── components/        # Layout, modals, UI primitives
│   │   └── pages/             # Dashboard, Wallets, Transactions, Budget, Goals, Advisor, Reports, Bills, Household, Landing
│   └── public/                # Icons, PWA manifest, service worker
├── AGENTS.md                  # This file (Agent instructions & conventions)
├── PROGRESS_LOG.md            # Activity and progress ledger
└── PROJECT_DOCUMENTATION.md   # Deep architectural specification
```

---

## 4. Local Development Commands

### Backend
```bash
cd backend
./venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend
npm start
```

### Environment Variables
- `backend/.env`: `MONGO_URL`, `DB_NAME=fincfo_db`, `CORS_ORIGINS`, `GEMINI_API_KEY`
- `frontend/.env`: `REACT_APP_BACKEND_URL=http://localhost:8001`, `PORT=3000`
