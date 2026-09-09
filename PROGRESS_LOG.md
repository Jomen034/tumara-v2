# Project Progress & Action Log

This file tracks all engineering actions, architectural decisions, refactoring, and milestones for Nusa.
**Rule for AI Agents:** Every time significant work or fixes are completed, insert a new log entry **at the TOP of "Progress Entries"** (reverse chronological order) using **WIB (Waktu Indonesia Barat / UTC+7)** timestamp format.

---

## Log Format Template
```markdown
### [YYYY-MM-DD HH:MM:SS WIB] — <Action Title>
- **Agent / Model:** <e.g. GitHub Copilot (Gemini 3.7 Flash) / Claude 3.7 Sonnet / Cursor / etc.>
- **Goal:** Brief description of the task.
- **Key Actions & Changes:**
  - `path/to/file`: Explanation of what changed and why.
- **Notes & Important Context:**
  - Specific considerations, credentials/env requirements, or known caveats.
```

---

## Progress Entries

### [2026-09-10 03:20:00 WIB] — Fix Google OAuth 2.0 Token Verification & UI Clean-up
- **Agent / Model:** GitHub Copilot (Gemini 3.7 Flash)
- **Goal:** Fix Google OAuth token verification fallback and remove duplicate button from auth modal.
- **Key Actions & Changes:**
  - `backend/auth.py`: Updated `google_auth` endpoint with clock skew tolerance (`clock_skew_in_seconds=10`), support for both `id_token` and `credential` field names, and fallbacks to Google `v3/tokeninfo` and `v3/userinfo` endpoints.
  - `frontend/src/pages/Landing.js`: Removed duplicate button inside the modal and rendered Google's official Sign-In button (`#googleSignInDiv`).
  - Pushed commit `f43e519` to GitHub `main` branch.
- **Notes & Important Context:**
  - Live production authentication on `https://tumara-v2.vercel.app` is now fully operational with Google OAuth 2.0.

### [2026-09-10 03:00:00 WIB] — Pure Google OAuth Login & Sanitized User Model
- **Agent / Model:** GitHub Copilot (Gemini 3.7 Flash)
- **Goal:** Make Google OAuth the single, clean authentication mechanism for live production and sanitize User model deserialization.
- **Key Actions & Changes:**
  - `backend/models.py`: Added `model_config = ConfigDict(extra="ignore")` to `User` model so Pydantic v2 gracefully handles extra fields (like `password_hash`).
  - `backend/auth.py`: Updated `google_auth` endpoint with dual-verification fallback (`google.oauth2.id_token` library + HTTP `tokeninfo` endpoint) and removed `password_hash` before instantiating `User`.
  - `frontend/src/pages/Landing.js`: Removed all demo mode buttons, test account pills, and manual forms. Streamlined the entire landing page and modal to official Google OAuth 2.0 (`google.accounts.id`).
  - Pushed commit `a2c99cb` to GitHub `main` branch.
- **Notes & Important Context:**
  - Google Sign-In is now the sole authentication method for live production.

### [2026-09-10 02:30:00 WIB] — Fix Render Deployment: Pin Python 3.11.9 Runtime & Relax Requirements
- **Agent / Model:** GitHub Copilot (Gemini 3.7 Flash)
- **Goal:** Fix Render build error where `pillow` wheel compilation failed under experimental Python 3.14.3.
- **Key Actions & Changes:**
  - `runtime.txt` & `backend/runtime.txt`: Created runtime file pinning Python to stable version `3.11.9` for Render.
  - `backend/requirements.txt`: Relaxed exact version constraints (`>=` instead of `==`) to allow pip to use pre-built binary wheels for Linux.
  - Pushed commit `c822634` to GitHub `main` branch to trigger automatic Render redeployment.
- **Notes & Important Context:**
  - Render will now use Python 3.11.9 with pre-compiled wheels for fast and error-free builds.

### [2026-09-09 02:25:00 WIB] — Cleanup: Removed Legacy `.emergent/` Folder
- **Agent / Model:** GitHub Copilot (Gemini 3.7 Flash)
- **Goal:** Remove legacy Emergent platform cron scripts, manifests, and system dependency files.
- **Key Actions & Changes:**
  - Deleted `.emergent/` directory (`.emergent/cron/`, `emergent.yml`, `system_deps.txt`, `markers/`).
- **Notes & Important Context:**
  - Repo is now completely clean and free of platform-specific boilerplate.

### [2026-09-09 02:15:00 WIB] — Git Push to Remote GitHub Repository
- **Agent / Model:** GitHub Copilot (Gemini 3.7 Flash)
- **Goal:** Push all rebranded code, standalone authentication, and production assets to remote GitHub repository.
- **Key Actions & Changes:**
  - Pushed commit `7f3b979` to `https://github.com/Jomen034/tumara-v2.git` on branch `main`.
- **Notes & Important Context:**
  - All changes successfully published on GitHub.

### [2026-09-09 02:00:00 WIB] — Complete Removal of Emergent Auth & Launch of Standalone Auth System
- **Agent / Model:** GitHub Copilot (Gemini 3.7 Flash)
- **Goal:** Completely replace Emergent platform authentication with a 100% self-contained authentication system (Email/Password + Direct Google OAuth 2.0 + Local Demo Mode).
- **Key Actions & Changes:**
  - `backend/auth.py`: Removed Emergent session verification dependency (`emergentagent.com`). Added `POST /api/auth/register` and `POST /api/auth/login` with `bcrypt` password hashing, `POST /api/auth/google` for direct Google ID token verification, and retained local demo mode (`POST /api/auth/dev-login`).
  - `backend/requirements.txt`: Added `bcrypt>=4.0.0` dependency.
  - `frontend/src/pages/Landing.js`: Designed and built a modal with Email & Password sign-in / registration tabs, direct Google sign-in trigger, and instant Local Demo access.
  - `frontend/src/context/AuthContext.js` & `App.js`: Removed legacy `#session_id=` hash routing and callback handlers.
  - End-to-End Testing: Verified user registration, password verification, cookie issuance, unauthorized attempt rejection (`401`), and session persistence.
- **Notes & Important Context:**
  - Tumara is now 100% independent of all Emergent platform endpoints.

### [2026-09-09 01:45:00 WIB] — End-to-End Local Testing Verification
- **Agent / Model:** GitHub Copilot (Gemini 3.7 Flash)
- **Goal:** Verify full end-to-end local runtime for the rebranded Tumara app.
- **Key Actions & Changes:**
  - `backend/db.py`: Added automatic failover to `mongomock_motor` for local offline/IP-restricted development when cloud MongoDB Atlas connections encounter TLS IP whitelist blocks.
  - End-to-End Test Suite: Tested local dev login (`/api/auth/dev-login`), user session (`/api/auth/me`), wallet creation (`/api/wallets`), and Tumara AI natural language transaction parsing (`/api/ai/parse-transaction`).
  - Verified React Frontend running on `http://localhost:3000` and FastAPI Backend running on `http://localhost:8001`.
- **Notes & Important Context:**
  - All local endpoints and AI features passed tests with `200 OK`.

### [2026-09-09 01:35:00 WIB] — Rebranding Step 3: Production Build, SPA Rewrites & Production Cookie Alignment
- **Agent / Model:** GitHub Copilot (Gemini 3.7 Flash)
- **Goal:** Prepare Tumara for 100% free production deployment on Vercel (frontend) + Render/PaaS (backend).
- **Key Actions & Changes:**
  - `frontend/vercel.json`: Created Vercel configuration with SPA route rewrite (`/(.*)` -> `/index.html`) to prevent 404s on page refresh.
  - `backend/auth.py`: Added `_set_session_cookie` helper to dynamically set `secure=True` and `samesite="none"` when `ENVIRONMENT=production`, supporting cross-domain cookies over HTTPS.
  - `frontend`: Verified clean production build via `npm run build` (`Compiled successfully`).
- **Notes & Important Context:**
  - Ready for zero-cost deployment on Vercel + Render + MongoDB Atlas + Google Gemini API.

### [2026-09-09 01:25:00 WIB] — Rebranding Step 2: Visual Assets & Icon Set Generation
- **Agent / Model:** GitHub Copilot (Gemini 3.7 Flash)
- **Goal:** Execute Step 2 of rebranding by generating high-resolution PNG & SVG brand assets for Tumara.
- **Key Actions & Changes:**
  - `frontend/public/icons/icon-192.png`, `icon-512.png`, `logo512.png`, `apple-touch-icon.png`: Generated high-DPI Tumara "T" brand icons with rounded obsidian containers and growth arrow geometry using Pillow.
  - `frontend/public/favicon.svg`: Created vector SVG favicon incorporating Tumara brand gradients, letter "T", and growth arrow element.
  - `frontend/public/index.html`: Added `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` for vector browser tab icon rendering.
- **Notes & Important Context:**
  - All icons follow PWA maskable standards and fit iOS/Android home screen display requirements.

### [2026-09-09 01:10:00 WIB] — Rebranding Step 1: Code, AI Prompts & Copy (Nusa -> Tumara)
- **Agent / Model:** GitHub Copilot (Gemini 3.7 Flash)
- **Goal:** Execute Step 1 of rebranding the entire application from "Nusa" to "Tumara" (*Tumbuh dengan arah*).
- **Key Actions & Changes:**
  - `backend/server.py`: Rebranded FastAPI title to `Tumara — Personal AI Finance CFO` and API healthcheck name.
  - `backend/ai_service.py`: Rebranded AI system prompt persona to `Tumara` with brand philosophy *"Tumbuh dengan arah"*, and updated offline fallback messages.
  - `backend/routes_finance.py` & `frontend/src/pages/Transactions.js`: Renamed transaction CSV export file from `nusa-transaksi.csv` to `tumara-transaksi.csv`.
  - `frontend/public/index.html` & `manifest.json`: Updated app title (`Tumara — Tumbuh dengan arah`), description, apple-mobile-web-app-title, and short_name.
  - `frontend/public/service-worker.js`: Updated PWA cache key to `tumara-v1`.
  - `frontend/src/components/Layout.js`: Updated logo mark to "T", brand text to "Tumara", and nav items to "Tumara AI".
  - `frontend/src/pages/Landing.js`: Rebranded landing page hero headline (*"Tumbuh dengan arah. Pegang kendali penuh."*), feature cards, logo badge ("T"), and footer copyright.
  - `frontend/src/pages/Advisor.js`: Rebranded AI chat header to "Tumara AI" and assistant greeting to *"Halo! Aku Tumara 👋"*.
  - `frontend/src/components/AddTransactionModal.js` & `Dashboard.js`: Updated assistant toasts, buttons, and status messages to Tumara.
  - `frontend/src/components/InstallPrompt.js`: Updated PWA banner to *"Install Tumara di HP kamu"*.
  - Storage Keys (`ThemeContext.js`, `App.js`, `Budget.js`, `Household.js`, `index.js`): Updated `localStorage` keys to `tumara-` prefixes while maintaining fallback migration for existing `nusa-` keys.
  - `README.md`, `PROJECT_DOCUMENTATION.md`, `.kilocode/rules.md`: Updated project documentation references.
- **Notes & Important Context:**
  - Preserved the existing dark obsidian/slate color theme intact.
- **Agent / Model:** GitHub Copilot (Gemini 3.7 Flash)
- **Goal:** Connect app to live cloud MongoDB Atlas cluster and fix 404 model error on Gemini API.
- **Key Actions & Changes:**
  - `backend/.env`: Updated `MONGO_URL` with user-provided MongoDB Atlas connection string (`cluster0.tb7jrjb.mongodb.net`).
  - `backend/ai_service.py`: Fixed `404 models/gemini-1.5-flash is not found` error by upgrading to `gemini-3.6-flash`, verified transaction parsing and streaming chat.
  - `.gitignore`: Updated root `.gitignore` to comprehensively exclude `backend/venv/`, `frontend/node_modules/`, environment files, and IDE cache files.
  - `AGENTS.md` & `PROGRESS_LOG.md`: Created agent guide file and persistent activity ledger.
- **Notes & Important Context:**
  - Active Gemini model in use: `gemini-3.6-flash`.
  - Database is live and verified on MongoDB Atlas v8.0.32.

### [2026-09-09 00:00:00 WIB] — Decoupling from Emergent AI Platform & Local Setup
- **Agent / Model:** GitHub Copilot (Gemini 3.7 Flash)
- **Goal:** Enable Nusa to run 100% locally and independently without proprietary Emergent cloud platform dependencies.
- **Key Actions & Changes:**
  - `backend/.env` & `frontend/.env`: Created local environment configuration files for API URLs, database URLs, and port mappings.
  - `backend/auth.py`: Added `POST /api/auth/dev-login` endpoint for instant local user login; configured session cookies with `secure=False, samesite="lax"` for local HTTP dev testing.
  - `backend/requirements.txt`: Removed proprietary `emergentintegrations` package; integrated official `google-generativeai` SDK.
  - `backend/ai_service.py`: Refactored all 4 AI capabilities (`advisor_stream`, `parse_transaction_text`, `generate_weekly_recap`, `scan_receipt`) to use direct Google Gemini (`GEMINI_API_KEY`) with local fallback logic.
  - `frontend/src/pages/Landing.js`: Added "Local Login" button to the header and hero section for one-click local login.
- **Notes & Important Context:**
  - The app connects to MongoDB via `MONGO_URL` in `backend/.env`.
  - Backend runs on port `8001` and frontend runs on port `3000`.
