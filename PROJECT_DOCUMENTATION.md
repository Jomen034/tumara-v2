# Nusa — Personal AI Finance CFO 📊🤖

> A household-friendly, AI-powered personal finance manager for Indonesia. Inspired by Budggt, built unique. Track every wallet, budget with the 50/30/20 rule, chat with an AI CFO that knows your numbers, scan receipts, log transactions by talking normally, share everything with your partner, and never miss a bill.

**Language:** Bahasa Indonesia · **Currency:** IDR (Rupiah) · **Installable:** PWA (Android & iOS)

---

## Table of Contents
1. [What It Does (Features)](#1-what-it-does-features)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Project Structure](#4-project-structure)
5. [Data Model (MongoDB Collections)](#5-data-model-mongodb-collections)
6. [Backend API Reference](#6-backend-api-reference)
7. [Environment Variables](#7-environment-variables)
8. [Running & Managing Locally](#8-running--managing-locally)
9. [How to Edit / Extend (Recipes)](#9-how-to-edit--extend-recipes)
10. [Self-Maintaining with VS Code + Kilo Code (AI Agents)](#10-self-maintaining-with-vs-code--kilo-code-ai-agents)
11. [Deployment](#11-deployment)
12. [Testing](#12-testing)
13. [Troubleshooting (Common Issues)](#13-troubleshooting-common-issues)
14. [Security & Privacy Notes](#14-security--privacy-notes)
15. [Roadmap / Backlog](#15-roadmap--backlog)
16. [FAQ — Data, Gemini & Going Independent](#16-faq--data-gemini--going-independent)

---

## 1. What It Does (Features)

| Area | Feature | Notes |
|------|---------|-------|
| **Dashboard** | Net worth, assets vs debt, monthly income/expense, **Financial Health Score (0–100)**, quick actions | Health score = net worth + savings rate + budget adherence + goals |
| **Wallets** | Multi-wallet: bank, e-wallet, credit card, PayLater, cash, investment | Quick-add presets (BCA, GoPay, OVO, DANA…) |
| **Transactions** | Income / Expense / Transfer; auto-adjusts wallet balances | Grouped by date; delete reverts balance |
| **AI Text Entry** | Type `isi bensin bp 92 400k pakai debit ocbc` → AI parses → **confirm / correct / reject** modal | Gemini matches wallet + category |
| **AI Receipt Scanner** | Photo of a receipt → extracts merchant, total, items, category | Optional: save each item as its own categorised transaction |
| **AI Advisor ("Nusa AI")** | Streaming chat that reads your real financial context | Warm, Indonesian, actionable |
| **Weekly AI Recap** | Dashboard card summarising the last 7 days + a tip | Cached per ISO week, manual refresh |
| **Budget** | 3-step wizard: 50/30/20 rule or custom limits; over-budget alerts | Per-category groups: needs / wants / savings |
| **Goals** | Savings goals with target, deadline, emoji, deposits, progress | Preset ideas (Dana Darurat, Liburan…) |
| **Bills** | Recurring bills (weekly/monthly/yearly/once), due-soon alerts, mark-as-paid | Optional auto-record expense + advance due date |
| **Reports** | Cash-flow trend, category donut, monthly savings bar, **net worth history** | Recharts |
| **Household Sharing** | Admin invites 1 partner (max 2) via link/code; shared data; per-member attribution + filter | Google login to join |
| **CSV** | Export all transactions; import historical CSV | Flexible ID/EN headers, auto-creates missing wallet |
| **UX** | Dark/light theme, **privacy mode** (blur balances), PWA install prompt (incl. iOS hint) | |
| **Auth** | Emergent-managed Google OAuth (session cookie) | No passwords stored |

---

## 2. Tech Stack

**Frontend**
- React 18 (Create React App)
- React Router v6 · Tailwind CSS v3 · Framer Motion (animations)
- Recharts (charts) · lucide-react (icons) · sonner (toasts) · axios
- PWA: `manifest.json` + service worker (production only)

**Backend**
- FastAPI (Python) · Motor (async MongoDB driver) · Pydantic v2
- `emergentintegrations` library → **Gemini 3 Flash** (`gemini-3-flash-preview`) for all AI
- Pillow (receipt image resize) · python-multipart (uploads)

**Database:** MongoDB (single database, name from `DB_NAME`)

**AI Key:** Emergent Universal LLM Key (`EMERGENT_LLM_KEY`) — one key for OpenAI/Anthropic/Gemini.

---

## 3. Architecture Overview

```
Browser (React PWA)
      │  HTTPS, all calls prefixed with /api
      ▼
Kubernetes Ingress ── /api/* ──► FastAPI (uvicorn :8001)
      └────────── /*   ──► React dev/prod server (:3000)
                                     │
                                     ▼
                                 MongoDB
                                     ▲
                                     │ (AI)
                        emergentintegrations → Gemini 3 Flash
```

- **Every backend route is under `/api`** (required for ingress routing).
- **Frontend always calls `process.env.REACT_APP_BACKEND_URL + /api`** — never hardcode.
- **Auth**: `POST /api/auth/session` exchanges the Emergent OAuth `session_id` for a session, sets an httpOnly cookie `session_token`. `get_current_user` validates it on every protected call.
- **Household layer**: a request dependency `get_ctx` resolves the user's `household_id` (auto-creating + migrating legacy data on first call). All finance data is scoped by `household_id`; each transaction also stores `member_id` (who logged it).

---

## 4. Project Structure

```
/app
├── backend/
│   ├── server.py            # FastAPI app; mounts /api router + all sub-routers + CORS
│   ├── db.py                # Mongo client (reads MONGO_URL, DB_NAME)
│   ├── models.py            # Pydantic models + constants (categories, wallet types, MAX members)
│   ├── auth.py              # Google OAuth session exchange, get_current_user, logout, complete-onboarding
│   ├── deps.py              # get_ctx / ensure_household (household resolution + data migration), household_members
│   ├── routes_finance.py    # wallets, transactions, budget, goals, dashboard, analytics, networth, CSV import/export
│   ├── routes_ai.py         # AI chat (stream), receipt scan, free-text parse, weekly recap
│   ├── routes_household.py  # household info, invite, join, members
│   ├── routes_bills.py      # bills CRUD, upcoming, pay
│   ├── ai_service.py        # Gemini prompts + calls (advisor, receipt, parse, recap, context builder)
│   ├── requirements.txt
│   └── .env                 # MONGO_URL, DB_NAME, EMERGENT_LLM_KEY, CORS_ORIGINS
│
├── frontend/
│   ├── public/
│   │   ├── index.html       # PWA meta tags, fonts
│   │   ├── manifest.json     # PWA manifest
│   │   ├── service-worker.js # caching (production only)
│   │   └── icons/            # app icons (192, 512, apple-touch)
│   ├── src/
│   │   ├── index.js          # entry; captures ?invite= code; registers SW in prod only
│   │   ├── App.js            # Router, AuthCallback, Protected routes, Shell (global modals + onboarding gate)
│   │   ├── index.css         # theme CSS variables (dark + light), utilities
│   │   ├── lib/
│   │   │   ├── api.js         # axios instance (baseURL = REACT_APP_BACKEND_URL/api, withCredentials)
│   │   │   ├── format.js      # IDR formatting, dates
│   │   │   └── constants.js   # categories, wallet types, presets
│   │   ├── context/
│   │   │   ├── AuthContext.js     # user session state
│   │   │   ├── ThemeContext.js    # theme + privacy toggle
│   │   │   └── RefreshContext.js  # global "bump" to re-fetch after mutations
│   │   ├── components/
│   │   │   ├── ui.js               # Button, Card, Modal, Input, Select, Progress, Badge, Spinner, EmptyState
│   │   │   ├── Layout.js           # sidebar + mobile bottom nav + header
│   │   │   ├── InstallPrompt.js    # PWA install banner
│   │   │   ├── AddTransactionModal.js  # manual + AI-text tabs
│   │   │   └── ScanReceiptModal.js     # receipt upload + itemised save
│   │   └── pages/
│   │       ├── Landing.js  Dashboard.js  Wallets.js  Transactions.js
│   │       ├── Budget.js   Goals.js      Advisor.js  Reports.js
│   │       └── Bills.js    Household.js
│   ├── package.json
│   └── .env                 # REACT_APP_BACKEND_URL, WDS_SOCKET_PORT, DANGEROUSLY_DISABLE_HOST_CHECK
│
├── memory/
│   ├── PRD.md               # product requirements + implementation log
│   └── test_credentials.md  # seeded test users/sessions (for testing agents)
└── PROJECT_DOCUMENTATION.md # ← this file
```

---

## 5. Data Model (MongoDB Collections)

All IDs are string UUID-style (`wal_...`, `txn_...`, etc.), **not** Mongo ObjectIds, so responses are JSON-safe.

| Collection | Key fields |
|-----------|-----------|
| `users` | `user_id`, `email`, `name`, `picture`, `onboarded`, `household_id`, `role` (admin/partner), `display_name`, `active` |
| `user_sessions` | `session_token`, `user_id`, `expires_at` |
| `households` | `id`, `name`, `owner_user_id`, `currency` |
| `household_invites` | `id`, `household_id`, `code`, `email?`, `status` (pending/accepted), `created_by` |
| `wallets` | `id`, `household_id`, `user_id`, `name`, `type`, `balance`, `color`, `icon` |
| `transactions` | `id`, `household_id`, `member_id`, `user_id`, `type`, `amount`, `wallet_id`, `to_wallet_id?`, `category`, `note`, `date`, `source` |
| `budgets` | `id`, `household_id`, `month` (YYYY-MM), `monthly_income`, `mode`, `categories[]` |
| `goals` | `id`, `household_id`, `title`, `target_amount`, `saved_amount`, `deadline?`, `emoji`, `color` |
| `bills` | `id`, `household_id`, `member_id`, `name`, `amount`, `category`, `recurrence`, `next_due_date`, `is_paid_current_cycle`, `wallet_id?` |
| `chat_messages` | `id`, `user_id`, `role` (user/assistant), `content`, `created_at` |
| `ai_recaps` | `household_id`, `week` (ISO), `content` |
| `networth_snapshots` | `household_id`, `date`, `assets`, `debt`, `net_worth` |

**Scoping rule:** finance data is filtered by `household_id`. `member_id` on a transaction records *who* created it (for attribution).

---

## 6. Backend API Reference

Base URL: `${REACT_APP_BACKEND_URL}/api`. All protected routes require the `session_token` cookie (or `Authorization: Bearer <token>`).

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/session` | Exchange Emergent `session_id` (header `X-Session-ID`) → sets cookie, returns user |
| GET | `/auth/me` | Current user |
| POST | `/auth/logout` | Clear session |
| POST | `/auth/complete-onboarding` | Mark user onboarded (used by "skip") |

### Household
| Method | Path | Description |
|--------|------|-------------|
| GET | `/household` | Household + members + pending invites + `can_invite` |
| POST | `/household/invite` | (admin) Create/return reusable invite `{code}` |
| POST | `/household/join` | `{code}` → join as partner (cap 2) |
| DELETE | `/household/invite/{id}` | (admin) revoke invite |
| DELETE | `/household/members/{user_id}` | (admin) remove partner |

### Wallets / Transactions / Budget / Goals
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/wallets` | list / create |
| PUT/DELETE | `/wallets/{id}` | update / delete |
| GET | `/transactions?limit=&member_id=` | list (optional member filter) |
| POST | `/transactions` | create (adjusts balances) |
| DELETE | `/transactions/{id}` | delete (reverts balances) |
| GET | `/transactions/export` | download CSV |
| POST | `/transactions/import` | upload CSV (`file`) |
| GET/POST | `/budget` | current-month budget |
| GET/POST | `/goals` · POST `/goals/{id}/deposit` · DELETE `/goals/{id}` | goals |
| GET | `/dashboard` | aggregated dashboard payload |
| GET | `/analytics` | trend + category breakdown |
| GET | `/networth/history` | net worth snapshots |

### Bills
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/bills` | list / create |
| GET | `/bills/upcoming?days=7` | due soon |
| PUT/DELETE | `/bills/{id}` | update / delete |
| POST | `/bills/{id}/pay` | mark paid (+ optional expense, advance date) |

### AI (Gemini 3 Flash)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/chat` | Streaming (text/plain) advisor reply; persists messages |
| GET/DELETE | `/ai/chat/history` | chat history / clear |
| POST | `/ai/scan-receipt` | multipart `file` → `{merchant,total,date,category,items[]}` |
| POST | `/ai/parse-transaction` | `{text}` → transaction draft (matches wallet + category) |
| GET | `/ai/weekly-recap?refresh=` | weekly summary (cached per week) |

---

## 7. Environment Variables

**`backend/.env`** (never commit real secrets):
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=fincfo_db
EMERGENT_LLM_KEY=sk-emergent-xxxxxxxx
CORS_ORIGINS=*
```

**`frontend/.env`**:
```
REACT_APP_BACKEND_URL=https://<your-app>.preview.emergentagent.com
WDS_SOCKET_PORT=443
DANGEROUSLY_DISABLE_HOST_CHECK=true
```

> ⚠️ **Rules:** Never hardcode URLs/ports in code — always read from env. Do not change `MONGO_URL`/`DB_NAME`/`REACT_APP_BACKEND_URL` keys. The backend must bind `0.0.0.0:8001`; the frontend runs on `3000`. Missing config should fail fast (no silent defaults).

---

## 8. Running & Managing Locally

This project is designed to run under **supervisor** (managed processes). You do **not** start servers manually.

```bash
# Restart after changing .env or installing dependencies
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sudo supervisorctl restart all

# Status & logs
sudo supervisorctl status
tail -n 100 /var/log/supervisor/backend.err.log
tail -n 100 /var/log/supervisor/frontend.out.log
```

Hot reload is on for both, so normal code edits apply automatically.

**Installing dependencies (the correct way):**
```bash
# Backend — install then freeze
cd /app/backend
pip install <package> && pip freeze > requirements.txt

# Frontend — use yarn (NOT npm)
cd /app/frontend
yarn add <package>
```

**Quick API check:**
```bash
curl -s $REACT_APP_BACKEND_URL/api/          # {"status":"ok",...}
```

### Running on your own machine (outside the platform)
1. Install: Node 18+, Yarn, Python 3.11+, MongoDB (or a MongoDB Atlas URL).
2. Backend:
   ```bash
   cd backend && pip install -r requirements.txt
   # set backend/.env (MONGO_URL, DB_NAME, EMERGENT_LLM_KEY)
   uvicorn server:app --host 0.0.0.0 --port 8001 --reload
   ```
3. Frontend:
   ```bash
   cd frontend && yarn install
   # set frontend/.env → REACT_APP_BACKEND_URL=http://localhost:8001
   yarn start
   ```
> Google OAuth is Emergent-managed. For fully local dev without the Emergent flow, seed a user + session directly in Mongo (see `memory/test_credentials.md`).

---

## 9. How to Edit / Extend (Recipes)

### Add a new spending category
`frontend/src/lib/constants.js` → add to `CATEGORIES` (name, lucide `icon`, `color`). It appears everywhere automatically. Optionally add it to the backend `CATEGORIES` list in `models.py` for AI prompts.

### Add a new API endpoint
1. Put the route in the relevant `routes_*.py`, using the household context:
   ```python
   from deps import get_ctx, Ctx
   @router.get("/my-thing")
   async def my_thing(ctx: Ctx = Depends(get_ctx)):
       return await db.my_collection.find({"household_id": ctx.hid}, {"_id": 0}).to_list(100)
   ```
2. It's already mounted (routers are included in `server.py`).
3. Call it from the frontend via `api.get('/my-thing')` (see `lib/api.js`).

### Add a new page
1. Create `frontend/src/pages/MyPage.js`.
2. Register the route in `App.js` inside the `<Shell>` block.
3. Add a nav item in `components/Layout.js` (`NAV` and optionally `BOTTOM`).

### Change AI behaviour / prompts
Edit `backend/ai_service.py`:
- `SYSTEM_PROMPT` → advisor personality
- `RECEIPT_PROMPT` → receipt extraction schema
- `parse_transaction_text` prompt → free-text parsing rules
- `WEEKLY_PROMPT` → recap style
- Model is `gemini-3-flash-preview` (change only via the integration playbook, not ad-hoc).

### Change the household member cap (paid tier)
`backend/models.py` → `MAX_HOUSEHOLD_MEMBERS`. (Roadmap: move to env/config.)

### Restyle the theme
`frontend/src/index.css` → CSS variables under `:root` (light) and `.dark` (dark). Colours are Bibit/Stockbit-inspired emerald + obsidian.

### Rules of thumb
- Frontend: fetch on mount and on `useRefresh().version`; call `bump()` after mutations to refresh other screens.
- Every interactive element gets a `data-testid` (used by automated tests).
- Keep components small; reuse `components/ui.js`.

---

## 10. Self-Maintaining with VS Code + Kilo Code (AI Agents)

You can continue developing this project on your own computer using **VS Code** with the **Kilo Code** extension (an open-source AI coding agent similar to Cline/Roo, supporting many LLM providers).

### A. Get the code onto your machine
- In the Emergent chat, use **"Save to GitHub"** to push the repo to your own GitHub.
- Then locally:
  ```bash
  git clone https://github.com/<you>/<repo>.git
  cd <repo>
  ```

### B. Install VS Code + Kilo Code
1. Install **VS Code**.
2. Open the **Extensions** panel (`Ctrl/Cmd+Shift+X`) → search **"Kilo Code"** → Install.
3. Open the Kilo Code panel from the sidebar.
4. **Connect an AI provider** (Settings → API Provider). Options include:
   - Anthropic (Claude), OpenAI (GPT), Google (Gemini), OpenRouter, or a local model via Ollama.
   - Paste your provider API key. (This is *your* key for coding — separate from the app's `EMERGENT_LLM_KEY`, which powers the app's in-product AI.)
5. Pick a model (e.g., Claude Sonnet or Gemini) and a mode:
   - **Ask** — questions about the codebase.
   - **Architect** — plan a change.
   - **Code** — let it edit files.
   - **Debug** — investigate errors.

### C. Give the agent context (important)
Point Kilo Code at this file and the PRD so it understands the project:
- Mention `PROJECT_DOCUMENTATION.md` and `memory/PRD.md` in your first prompt.
- Optionally create a **`.kilocode/rules.md`** (or `.clinerules`) at the repo root with house rules, e.g.:
  ```md
  # Project rules for AI agents
  - Backend routes MUST be under /api and use the get_ctx household dependency.
  - Frontend MUST call process.env.REACT_APP_BACKEND_URL + /api (never hardcode URLs).
  - Use yarn (not npm). Backend deps: pip install then pip freeze.
  - Every interactive element needs a data-testid.
  - Don't return raw Mongo docs (always project {"_id": 0}); IDs are string UUIDs.
  - AI model is gemini-3-flash-preview via emergentintegrations.
  ```

### D. Typical local workflow with the agent
1. Run the app locally (see §8) so you can see changes live.
2. In Kilo Code **Code** mode, describe the change:
   > "Add a `notes` field to bills, show it in the Bills card, and include it in the bill modal form."
3. Review the diff Kilo proposes, approve edits, and test in the browser.
4. Commit with git and push. Redeploy (see §11) when happy.

### E. Good prompts to reuse
- *"Read PROJECT_DOCUMENTATION.md §6 and add endpoint X following the existing household-scoped pattern."*
- *"Add a new page following the pattern in §9 'Add a new page'."*
- *"Find and fix why the dashboard net worth is wrong — check routes_finance.py `_apply_txn` and `_snapshot_networth`."*

> Tip: keep changes small and test after each. The agent works best with focused tasks and clear acceptance criteria.

---

## 11. Deployment

- **On Emergent:** use the platform's **Deploy** button. It builds a production frontend (where the service worker + PWA install become active) and runs the backend. Set env vars in the deploy settings.
- **Elsewhere (Vercel/Railway/your VPS):**
  - Backend: containerise FastAPI (uvicorn on `:8001`), provide `MONGO_URL`, `DB_NAME`, `EMERGENT_LLM_KEY`.
  - Frontend: `yarn build` → serve the static `build/` folder; set `REACT_APP_BACKEND_URL` to the backend's public URL at build time.
  - Ensure the frontend and backend are reachable and CORS/`CORS_ORIGINS` is configured.
- **PWA note:** installability requires HTTPS + the service worker, which is enabled in production builds only (disabled in dev to avoid stale-cache issues — see `frontend/src/index.js`).

---

## 12. Testing

- Automated test suites live in `backend/tests/` (`backend_test.py`, `test_new_features.py`, `test_round3.py`) and reports in `test_reports/`.
- Auth-gated tests seed a Mongo user + session (real Google login can't be automated) — see `memory/test_credentials.md`.
- Quick manual API test:
  ```bash
  T=test_session_cfo_001
  curl -s $REACT_APP_BACKEND_URL/api/dashboard -H "Authorization: Bearer $T" | python3 -m json.tool
  ```
- Frontend uses `data-testid` attributes throughout for reliable UI automation.

---

## 13. Troubleshooting (Common Issues)

| Symptom | Likely cause / fix |
|--------|--------------------|
| App stuck on loading spinner | `REACT_APP_BACKEND_URL` wrong or app opened on a different domain than the API. Confirm the value in `frontend/.env` matches the URL you're visiting; restart frontend. |
| 401 on every request | Session cookie missing/expired. Re-login. For tests, re-seed the session in Mongo. |
| Backend won't start | Check `tail -n 100 /var/log/supervisor/backend.err.log` — usually a missing import (`pip install` + freeze) or bad `.env`. |
| AI endpoints error | `EMERGENT_LLM_KEY` missing or out of balance (Profile → Manage plan → Universal Key → Add Balance). |
| Changes not showing | Hot reload usually handles it; if `.env`/deps changed, `sudo supervisorctl restart <service>`. |
| Stale PWA content after deploy | Service worker cache — bump the `CACHE` name in `public/service-worker.js`. |
| CSV import created odd wallets | Import auto-creates a cash wallet for unknown wallet names; use exact existing names to avoid duplicates. |
| Bill paid twice | UI guards double-tap; if scripting the API, add your own idempotency (roadmap item). |

---

## 14. Security & Privacy Notes
- Auth is Google OAuth via Emergent; **no passwords are stored**. Sessions are httpOnly cookies with a 7-day expiry.
- All finance data is scoped by `household_id`; balance-changing writes are scoped to the owning household to prevent cross-tenant writes.
- **Privacy mode** blurs all monetary values on-device (a UI toggle, stored in `localStorage`).
- Invites are random codes; anyone with a code can join until the 2-member cap is reached — treat invite links like passwords.
- Do not commit real `.env` values or the `EMERGENT_LLM_KEY` to a public repo.

---

## 15. Roadmap / Backlog
- **Push reminders** for bills (Web Push / VAPID) — notify even when the app is closed.
- **Shared goals** contribution breakdown per member.
- **Bulk paste** transaction entry.
- **PDF** monthly household report export.
- Backend **idempotency** guard on bill payment.
- **Member data split/merge** when a partner leaves a household.
- **Multi-currency**; move `MAX_HOUSEHOLD_MEMBERS` to config for a paid tier.
- Credit-card / PayLater spending auto-increases debt balance.

---

_Built with 💚 for Indonesians who want to finally take control of their money. — Nusa © 2026_

---

## 16. FAQ — Data, Gemini & Going Independent

### Q1. Where does the database live and where does my data go?
The app uses **MongoDB**, and it lives **wherever `MONGO_URL` (in `backend/.env`) points** — the code never hardcodes a location.

| Context | Where the DB is | Persistence |
|---------|-----------------|-------------|
| Emergent **preview** (development) | MongoDB inside your app container (`mongodb://localhost:27017`, db `fincfo_db`) | For dev/testing; can be reset |
| Emergent **Deploy** (production) | Managed, persistent MongoDB provisioned by the platform | Survives restarts |
| **Self-hosted** | Your own MongoDB — e.g. a free **MongoDB Atlas** cluster or a VPS | You own & control it |

To move your data to your own database, set `MONGO_URL` to your connection string (and `DB_NAME`) and restart the backend. Everything (users, wallets, transactions, households, bills…) is stored there. There is no separate/hidden storage — all app data is in this one MongoDB.

### Q2. How is Gemini integrated? Which account / API key is used?
- **Library:** `emergentintegrations` (installed in the backend). See `ai_service.py`.
- **Model:** `gemini-3-flash-preview`.
- **Credential:** the **Emergent Universal LLM Key** — `EMERGENT_LLM_KEY` in `backend/.env`. This is **NOT** a personal Google Cloud / Google AI Studio account. It's one Emergent-issued key that transparently routes to Google Gemini (and can also reach OpenAI/Anthropic).
- **Billing:** usage is charged against your **Emergent credits** (Profile → Manage plan → Universal Key → Add Balance / enable auto top-up). If the balance runs out, AI features (advisor, receipt scan, text parse, weekly recap) will error until topped up.
- **Where it's called:** only server-side in `ai_service.py`. The key is never exposed to the browser.

**Using your OWN Gemini key instead (when self-hosting):** get a key from Google AI Studio, then in `ai_service.py` replace the Emergent client with the standard Google Generative AI SDK (or set the SDK to your key). This removes the Emergent dependency for AI, and billing moves to your Google account. (This is the only place AI is wired, so it's a contained change.)

### Q3. Can I do ALL future work only in VS Code + Kilo Code — even on Kilo's free model?
**Yes, for the coding/maintenance work.** A free model via the Kilo Code Gateway can read this repository and implement features, fixes, and refactors. But understand these realities:

**There are TWO separate "AIs" — don't confuse them:**
| | Coding AI (Kilo Code) | App runtime AI (in Nusa) |
|---|---|---|
| Purpose | Helps *you write/edit code* in VS Code | Powers advisor chat, receipt scan, text parse, weekly recap for end-users |
| Credential | Your Kilo provider (free Kilo gateway model, or your own key) | `EMERGENT_LLM_KEY` (or your own Gemini key) |
| Who pays | Free tier (rate-limited) | Emergent credits / your Google account |

➡️ **Using Kilo's free model to code does *not* make the app's AI free.** The running app still needs `EMERGENT_LLM_KEY` (or your own Gemini key) for its AI features.

**What you CAN do fully in VS Code + Kilo (free model):**
- Read/understand the codebase (point Kilo at this file + `memory/PRD.md`).
- Add fields, pages, endpoints; fix bugs; restyle; adjust prompts.
- Commit with git and push to your GitHub.

**Practical caveats of the free model:**
- More rate-limited and less "smart" than paid models → keep tasks **small and specific**, review each diff, and test after every change. Large multi-file refactors may need several careful steps.
- Give it guardrails via a `.kilocode/rules.md` (see §10) so it follows project conventions.

**Things Kilo alone does NOT handle (you still need to do these):**
1. **Run/host the app.** Kilo only edits files. You must run it locally (Node + Python + MongoDB, see §8) or deploy it (see §11).
2. **A database.** Use local MongoDB or a free MongoDB Atlas cluster.
3. **The app's AI key.** Keep `EMERGENT_LLM_KEY`, or switch `ai_service.py` to your own Gemini key.
4. **Authentication.** Google login is **Emergent-managed**. Two options when going independent:
   - Keep calling Emergent's OAuth endpoint (simplest — auth keeps working as-is), or
   - Swap in your own auth (e.g., Google OAuth with your own client ID, or email/password). This touches `auth.py` (backend) and the login button in `Landing.js` + `AuthContext.js` (frontend).

**Bottom line:** Ongoing maintenance and feature development can absolutely be done in VS Code with Kilo Code on a free model. Just budget for (a) hosting, (b) a MongoDB, and (c) the app's own AI usage — those are separate from your free coding assistant.

