# Tumara — Personal AI Finance CFO (PRD)

## Product Vision & Positioning
Personal AI finance CFO and household budgeting app for Indonesia. Lifetime access model (sekali bayar seumur hidup), 100% bebas iklan dan pelacak komersial, dipandu asisten AI personal dengan data finansial riil. Installable sebagai PWA di Android & iOS.

## Core Choices
- **Auth:** Independent Email & Password (`bcrypt`) + License Access Code activation + Household Partner Invites + Direct Google OAuth 2.0.
- **AI Model:** Google Gemini (`gemini-3.8-flash` via official `google-genai` / `google-generativeai`) using `GEMINI_API_KEY`.
- **AI Capabilities:** Context-aware Financial Advisor (Personal CFO), Smart Itemized Receipt OCR Scanner, Natural Language Quick Transaction Parser, and Automated Weekly AI Financial Health Recap.
- **Currency & Language:** IDR (Rupiah) / Bahasa Indonesia.
- **Design Philosophy:** Clean obsidian dark theme with emerald mint accent (`#10b981`), high readability, intuitive financial data visualization.

## Architecture
- **Frontend:** React 18 (SPA) + Tailwind CSS + Framer Motion + Recharts + Lucide Icons + Sonner Toasts, PWA (manifest + service worker + install prompts).
- **Backend:** FastAPI + Motor (Async MongoDB Driver) + Pydantic v2 + Bcrypt + Pillow.
- **Database:** MongoDB Atlas / Local MongoDB (`fincfo_db`).
- **Payment & Checkout:** Dual-Mode Engine (`routes_orders.py`): Sandbox/Instant Simulation for testing + Midtrans Snap Webhook-ready for live production.

## Core Feature Matrix
- Multi-wallet (bank, e-wallet, credit card, PayLater, cash, investment) with auto-ledger balances (assets vs debt).
- Transactions (income / expense / transfer) with household member attribution and automatic balance rollback on delete.
- Smart Budgeting (50/30/20 auto-balancer, custom category creation, deletion safety guardrails, health diagnostics).
- Savings Goals (target nominal, target date, auto-deposit progress).
- Home Dashboard (real-time net worth, 0–100 Financial Health Score, Daily Spend Pulse, cashflow pills, budget mini-progress).
- Reports (cashflow trends, category donuts, monthly savings rate, historical net worth snapshots).
- Bill Calendar & Heatmap (recurring bills, density indicators, due-soon alerts, mark-as-paid auto-journaling).
- Couple Finance Center (household sharing, 50/50 and proportional income split calculator, shared net worth).
- Itemized Receipt OCR Scanner (subtotals, product items, discounts, tax detection, per-item category overrides).
- Dual-Mode Checkout Funnel (Starter Rp 49k, Pro Rp 99k, Family Rp 169k) with dynamic license code generation and seamless onboarding auto-login.

## Implementation Milestones
- **Round 1:** Full Core MVP (auth, wallets, transactions, budget, goals, dashboard, reports).
- **Round 2:** Natural Language Parser, Onboarding Flow, Itemized Receipt Scanner, Weekly AI Recap, Net Worth Snapshots.
- **Round 3:** Household Sharing (2 members), Bill Reminders & Heatmap, CSV Export/Import.
- **Round 4:** Design Overhaul, 8 Self-Hosted SVG Avatars, Taxonomy Overhaul (Groceries isolation), Independent Budget Controls, Markdown Typography.
- **Round 5 (Current):** Dual-Mode Checkout & Order Engine, Dynamic Access Code Generation (`TMR-STR-`, `TMR-PRO-`, `TMR-FAM-`), AI Fair Usage Quota Limits, Sandbox Instant Payment Simulation, Auto-Registration Onboarding.
