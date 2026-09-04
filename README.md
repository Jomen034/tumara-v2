# Nusa — Personal AI Finance CFO 📊🤖

A household-friendly, AI-powered personal finance manager for Indonesia (Bahasa Indonesia · IDR · installable PWA).
Track wallets, budget with 50/30/20, chat with an AI CFO that knows your numbers, scan receipts, log
transactions by typing naturally, share everything with your partner, and never miss a bill.

> 📘 **Full documentation:** see [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) — features, API reference,
> data model, how to edit/extend, maintaining it in VS Code + Kilo Code, deployment, and an FAQ on the database,
> Gemini key, and going independent.

## Highlights
- 🏦 Multi-wallet (bank, e-wallet, credit card, PayLater, cash, investment) + net worth & health score
- 🤖 AI advisor chat, receipt scanner, and natural-language entry ("isi bensin bp 92 400k pakai debit ocbc")
- 📊 Budget wizard, savings goals, bill reminders, reports (trend/category/net-worth history)
- 👨‍👩‍ Household sharing (admin + 1 partner) with per-member attribution
- ⬇️⬆️ CSV export & import · 🌗 dark/light + privacy mode · 📱 PWA install

## Tech Stack
- **Frontend:** React (CRA), Tailwind CSS, Framer Motion, Recharts, lucide-react, sonner, axios
- **Backend:** FastAPI, Motor (MongoDB), Pydantic v2, Pillow
- **AI:** Gemini 3 Flash (`gemini-3-flash-preview`) via `emergentintegrations` (`EMERGENT_LLM_KEY`)
- **Auth:** Emergent-managed Google OAuth

## Quick Start (local)
```bash
# Backend
cd backend && pip install -r requirements.txt
# set backend/.env: MONGO_URL, DB_NAME, EMERGENT_LLM_KEY
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend
cd frontend && yarn install
# set frontend/.env: REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```
On the Emergent platform, services run under supervisor:
`sudo supervisorctl restart backend frontend`.

## Environment
`backend/.env`: `MONGO_URL`, `DB_NAME`, `EMERGENT_LLM_KEY`, `CORS_ORIGINS`
`frontend/.env`: `REACT_APP_BACKEND_URL`, `WDS_SOCKET_PORT`, `DANGEROUSLY_DISABLE_HOST_CHECK`

> Rules: never hardcode URLs/keys; all backend routes live under `/api`; the frontend always calls
> `REACT_APP_BACKEND_URL + /api`. See [`.kilocode/rules.md`](./.kilocode/rules.md) for AI-agent conventions.

## Project Layout
```
backend/   FastAPI app (server.py, routes_*.py, ai_service.py, deps.py, models.py, auth.py)
frontend/  React app (src/pages, src/components, src/context, src/lib)
memory/    PRD.md, test_credentials.md
PROJECT_DOCUMENTATION.md   full guide
```

## Maintaining with AI (VS Code + Kilo Code)
This repo ships a [`.kilocode/rules.md`](./.kilocode/rules.md) so AI coding agents follow project conventions.
Point your agent at `PROJECT_DOCUMENTATION.md` first. Note: the coding assistant (Kilo) is separate from the
app's runtime AI (Gemini via `EMERGENT_LLM_KEY`) — see the FAQ in the full docs.

---
_Nusa © 2026 — built for taking control of your money._
