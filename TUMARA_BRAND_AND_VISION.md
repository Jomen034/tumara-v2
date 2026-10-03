# Tumara — Brand, Spirit, and Core Values

**Tumbuh dengan arah.**

---

## 1. Brand Identity & Origin

- **Product Name**: **Tumara** (derived from ***Tumbuh*** [grow] + ***Arah*** [direction]).
- **Tagline & Core Philosophy**: **"Tumbuh dengan arah."**
- **Brand Purpose**: Mirrors the user's financial journey — starting as a simple transaction tracker and evolving into a complete AI Personal CFO, growing with clear purpose and direction rather than just accumulating money.
- **Brand Positioning**: Avoids generic finance, wallet, or money keywords to build an approachable, long-term brand identity.

---

## 2. Product Vision & Target Audience

- **Target Users**: Indonesian individuals, couples, and families (starting with households as the initial wedge market).
- **Core Purpose**: Helps users log financial activity, track multi-account balances, analyze spending patterns, forecast future finances, plan goals, and receive AI-driven coaching.
- **Key Questions Tumara Answers**:
  - *Where did my money go?*
  - *Is my financial condition healthy?*
  - *What financial decision should I make next?*
  - *When can I afford a house, my child's education, or retirement?*

---

## 3. Core Spirit & Culture

- **Live Dogfooding ("Grow with the product")**: Every stable milestone is deployed directly to Vercel and used daily on mobile devices by the team and real users.
- **Calm, Credible, and Approachable**: Inspired by Bibit's Robo-Advisor philosophy (*Tumbuh Bersama*) — making complex financial data simple, clear, and calm without flashy gimmicks or dense accountant-style reports.

---

## 4. Non-Negotiable Core Values

1. **Bahasa Indonesia First**: All user-facing copy, categories, buttons, notifications, and AI responses use natural, everyday Bahasa Indonesia (e.g., *Pemasukan*, *Pengeluaran*, *Catat*, *Rekap*).
2. **Privacy & Trust Through Transparency**:
   - Strict Household-Level Isolation (`household_id`) on every data query with secure session tokens.
   - **Data Minimization**: Never asks for or stores real bank account numbers, PINs, or banking credentials (only custom account labels like "BCA Debit").
   - Dedicated in-app **Keamanan & Privasi** transparency page.
3. **AI-Agnostic Architecture**: All AI components (parser, coaching engine) are wrapped behind swappable interfaces so models can change without refactoring the app.
4. **Free-Tools-First & Cost Efficiency**: Built on a modern, cost-effective stack (React, FastAPI, MongoDB, Gemini Flash) while prioritizing user data privacy.
5. **Iterative Increment Growth**: Built strictly step-by-step in clear, executable increments.

---

## 5. UI & Design System Principles

- **Light Mode & Dark Mode Harmony**: Clean emerald & obsidian visual hierarchy representing growth, clarity, and calm stability.
- **Simplicity over Density**: Essential totals shown first; breakdown details disclosed cleanly on demand.
- **Visual Anchors**: Large, highly legible numbers (`formatRupiah`) serve as key focal points on every screen.

---

## 6. Logo, Asset, & Visual Identity

- **The Logo Glyph**: 
  - Represents the synthesis of ***Tumbuh*** (the rooted vertical growth stem) and ***Arah*** (the forward-upward directional arrow vector).
  - Encased in a rounded squircle badge with an energetic emerald-to-mint gradient (`#10B981` → `#34D399` / `#059669`).
  - Implemented as a pure, responsive vector SVG component (`<TumaraLogo />`) and exported to high-resolution PWA icons (`icon-512.png`, `icon-192.png`, `apple-touch-icon.png`, `favicon.svg`) for an authentic native app presence on Android and iOS home screens.
- **Avatar System**:
  - 8 distinct, friendly, and modern illustrated characters: **Aria**, **Bima**, **Citra**, **Daffa**, **Elena**, **Fajar**, **Gita**, and **Hadi**.
  - **100% Self-Hosted Vector Assets**: Embedded directly within `avatars.js` as SVG data URIs, completely eliminating third-party API dependencies (no DiceBear 403 blocks, CORS, or rate limits). Works 100% offline in PWA mode.
  - Smooth backward-compatibility fallback from legacy avatar URLs.
- **Canonical Emoji & Icon Standards**:
  - Consistent and intuitive emoji associations across all screens:
    - **Categories**: `🛒` Groceries, `🍜` Makanan & Minuman, `🚗` Transportasi, `🛍️` Belanja, `⚡` Tagihan & Utilitas, `🎮` Hiburan & Hobi, `💊` Kesehatan, `🎓` Pendidikan, `📈` Investasi, `💰` Gaji & Pemasukan, `🎁` Hadiah & Donasi, `📦` Lainnya.
    - **Transaction Types**: `💸` Pengeluaran, `💰` Pemasukan, `🔄` Transfer Antar Dompet.
    - **Budget Groups (50/30/20)**: `🛡️` Kebutuhan (Needs), `✨` Keinginan (Wants), `📈` Tabungan & Investasi (Savings).
