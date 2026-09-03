# Nusa — Personal AI Finance CFO (PRD)

## Original Problem Statement
Build a personal AI finance CFO inspired by budggt.com — unique, not identical, using free tools. Blank repo: github.com/Jomen034/tumara-v2. Must be installable as a PWA on Android & iOS.

## User Choices
- Auth: Emergent-managed Google social login
- AI model: Gemini 3 Flash (gemini-3-flash-preview) via Emergent Universal LLM key
- AI features: AI advisor chat + AI receipt scanner
- Currency/Language: IDR (Rupiah) / Bahasa Indonesia
- Design: Bibit/Stockbit-inspired palette (emerald + dark obsidian). App name "Nusa".

## Architecture
- Frontend: React (CRA) + Tailwind + framer-motion + recharts + sonner, dark/light theme, PWA (manifest + service worker + install prompt).
- Backend: FastAPI + Motor (MongoDB). Modules: db, models, auth, ai_service, routes_finance, routes_ai.
- AI: emergentintegrations LlmChat (Gemini). Advisor = SSE-style streamed text; Receipt scanner = image → JSON extraction.

## Core Requirements (static)
- Multi-wallet (bank, e-wallet, credit card, PayLater, cash, investment) with balances
- Transactions (income/expense/transfer) auto-adjust wallet balances
- Budget wizard (percentage 50/30/20 or fixed) + over-budget alerts
- Savings goals with deposits & progress
- Dashboard: net worth, financial health score (0-100), quick actions, budget progress, recent txns
- Reports: cash-flow trend, category donut, monthly savings bar
- AI advisor chat (context-aware) + receipt scanner
- Privacy mode (hide balances), theme toggle, Google login, PWA install

## Implemented (2026-06)
- Full backend API (auth, wallets, transactions, budget, goals, dashboard, analytics, AI chat + receipt scan)
- Full frontend (Landing, Dashboard, Wallets, Transactions, Budget wizard, Goals, Advisor, Reports)
- Google OAuth flow, PWA (icons, manifest, SW, install banner incl. iOS hint)

## Implemented — Round 2 (2026-06)
- Natural-language transaction entry: type "isi bensin bp 92 400k pakai debit ocbc" → Gemini parses → confirmation modal (approve / correct / reject). Endpoint POST /api/ai/parse-transaction (matches wallet + category).
- First-run onboarding: new users auto-redirected into the budget wizard (with skip). POST /api/auth/complete-onboarding.
- Itemized receipts: scanner returns per-item categories; toggle to save each item as its own transaction.
- Weekly AI recap card on dashboard (GET /api/ai/weekly-recap, cached per ISO week + manual refresh).
- Net worth history chart on Reports (snapshots recorded on wallet/txn changes; GET /api/networth/history).
- SW registered production-only (dev unregisters to avoid stale-cache hangs).

## Backlog / Next
- P2: Recurring transactions & bill reminders
- P2: Multi-currency, export CSV/PDF
- P2: Push weekly recap notification; empty-state on net-worth chart for brand-new users
- P2: Credit-card/PayLater spend should auto-increase debt balance
