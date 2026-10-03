# Tumara — Personal AI Finance CFO (PRD)

## Original Problem Statement
Build a personal AI finance CFO inspired by budggt.com — unique, not identical, using free tools. Blank repo: github.com/Jomen034/tumara-v2. Must be installable as a PWA on Android & iOS.

## User Choices
- Auth: Emergent-managed Google social login
- AI model: Gemini 3 Flash (gemini-3-flash-preview) via Emergent Universal LLM key
- AI features: AI advisor chat + AI receipt scanner
- Currency/Language: IDR (Rupiah) / Bahasa Indonesia
- Design: Bibit/Stockbit-inspired palette (emerald + dark obsidian). App name "Tumara".

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

## Implemented — Round 3 (2026-06): Household + Bills + CSV
- Household sharing: admin invites 1 partner (max 2 active members) via shareable invite link/code (free, Google login to join). All wallets/budgets/transactions/reports shared; each transaction attributed to the member who logged it; per-member spend breakdown + member filter on Transactions. Endpoints: /api/household(+invite/join/members). Auto-migration backfills legacy single-user data into a household.
- Bill reminders: recurring bills (weekly/monthly/yearly/once) with due dates, "due soon" card on dashboard, mark-as-paid (auto-records expense + advances due date). /api/bills(+upcoming/{id}/pay). Double-pay guarded in UI.
- CSV export (/api/transactions/export) + import (/api/transactions/import, auto-creates missing cash wallet, flexible ID/EN headers).
- Verified: 14/14 round3 backend + 13/13 regression + frontend flows.

## Implemented — Round 4 (2026-10): Comprehensive Polish, Taxonomy, Brand & Visual Refresh
- **Bill Heatmap Calendar (`/bills`)**: Interactive monthly heatmap displaying bill due-date density, color intensity indicators, and popover for dates with multiple bills.
- **Couple Finance Center (`/household`)**: Split expense calculator (50/50, fair share proportional to income, or custom), settlement tracker, and member attribution.
- **Proportional Wallet Modal Controls (`/wallets`)**: Optimized layout for Add/Edit buttons on wallet details.
- **Home Dashboard UX Redesign (`/dashboard`)**: Monthly cashflow summary pills, quick filter chips, interactive budget mini-progress widget, and clear net worth visibility.
- **Intelligent Financial Taxonomy**:
  - Isolated `Groceries & Kebutuhan Rumah` from `Makanan & Minuman` (culinary/ready-to-eat) and `Belanja` (lifestyle/discretionary).
  - Domain-aware AI receipt scanner prompt recognizing supermarket lines (GrandLucky, Superindo, etc.) and allowing per-item category overrides.
  - Aligned groceries and health expenses into the Needs (50%) budget group.
- **Independent Budgeting & Smart Guardrails (`/budget`)**:
  - Add custom budget categories dynamically (`POST /budget/category`).
  - Delete budget categories safely with confirmation guardrails (`DELETE /budget/category/{category}`).
  - Quick inline salary update (`PUT /budget/income`).
  - Real-time financial health diagnostic (zero-based budgeting status, over-allocation warnings, wants >35% alerts, savings <15% alerts).
  - One-click auto-balance according to the 50/30/20 formula.
- **Brand Visual Assets & AI Response Typography**:
  - Vector brand logo (`<TumaraLogo />`) representing the growth stem ("Tumbuh") and directional vector ("Arah").
  - Fresh PWA icons (`icon-512.png`, `icon-192.png`, `apple-touch-icon.png`, `favicon.svg`).
  - 8 modern, illustrated self-hosted SVG avatars (Aria, Bima, Citra, Daffa, Elena, Fajar, Gita, Hadi) with zero external dependency.
  - Standardized canonical emoji dictionary across categories, budget groups, and transaction types.
  - Custom markdown typography renderer (`<FormattedMessage />`) for Tumara AI streaming advisor responses.

## Backlog / Next
- P2: Real push notifications (Web Push/VAPID) for bill reminders
- P2: Bill-pay backend idempotency guard (is_paid_current_cycle)
- P2: Member data split/merge when a partner leaves a household
- P2: Multi-currency; MAX_HOUSEHOLD_MEMBERS to config for paid tier
- P2: Credit-card/PayLater spend should auto-increase debt balance
