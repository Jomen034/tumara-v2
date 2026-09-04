# Project Rules for AI Agents (Kilo Code / Cline / Roo)

You are working on **Nusa — Personal AI Finance CFO** (React + FastAPI + MongoDB).
Read `PROJECT_DOCUMENTATION.md` and `memory/PRD.md` before making changes.
Keep tasks small and focused; review each diff and test after every change.

## Golden rules (do not break)
- **API prefix:** every backend route MUST live under `/api`. Routers are mounted in `backend/server.py`.
- **No hardcoded URLs/ports/keys.** Backend reads env via `os.environ`; frontend calls
  `process.env.REACT_APP_BACKEND_URL + "/api"` (use the axios instance in `src/lib/api.js`).
  Never change the keys `MONGO_URL`, `DB_NAME`, `REACT_APP_BACKEND_URL`.
- **Household scoping:** all finance data is scoped by `household_id`. In backend routes use the
  dependency `ctx: Ctx = Depends(get_ctx)` (from `backend/deps.py`) and query with `{"household_id": ctx.hid}`.
  Store `member_id = ctx.user.user_id` on transactions for attribution.
- **Mongo hygiene:** never return raw Mongo docs. Always project `{"_id": 0}`. IDs are string UUIDs
  (`wal_`, `txn_`, `bill_`, `goal_`, `hh_`, `inv_`), NOT ObjectIds. Use `datetime.now(timezone.utc)`.
- **Auth:** authentication is Emergent-managed Google OAuth. Do not invent new auth flows without asking.
  Protected routes depend on `get_current_user` / `get_ctx`. Sessions are httpOnly cookie `session_token`.
- **AI:** all AI runs server-side in `backend/ai_service.py` via `emergentintegrations`, model
  `gemini-3-flash-preview`, using `EMERGENT_LLM_KEY`. Don't call LLMs from the frontend.
- **Frontend UX:** every interactive/important element needs a unique `data-testid` (kebab-case).
  Reuse primitives in `src/components/ui.js`. Keep components small. Language = Bahasa Indonesia, currency = IDR.
  After a mutation, call `useRefresh().bump()` so other screens re-fetch; screens re-fetch on `version` change.

## Dependencies & processes
- Frontend: **use yarn** (`yarn add <pkg>`), never npm.
- Backend: `pip install <pkg> && pip freeze > requirements.txt`.
- Services run under supervisor. After `.env` or dependency changes:
  `sudo supervisorctl restart backend` / `frontend`. Hot reload handles normal code edits.
- Logs: `/var/log/supervisor/backend.err.log`, `/var/log/supervisor/frontend.out.log`.

## Where things are
- Backend: `server.py`, `db.py`, `models.py`, `auth.py`, `deps.py`,
  `routes_finance.py`, `routes_ai.py`, `routes_household.py`, `routes_bills.py`, `ai_service.py`.
- Frontend pages: `src/pages/*` — add a route in `src/App.js` (inside `<Shell>`) and a nav item in `src/components/Layout.js`.
- Categories/wallet types/presets: `src/lib/constants.js`. Theme variables: `src/index.css`.

## Testing
- Suites in `backend/tests/`. Auth-gated tests seed a Mongo user+session (see `memory/test_credentials.md`).
- Quick check: `curl -s $REACT_APP_BACKEND_URL/api/` should return `{"status":"ok",...}`.

## Definition of done
1. Change is minimal and matches existing patterns. 2. Backend curl / frontend view verified.
3. No hardcoded config. 4. `data-testid`s added. 5. Docs updated if behaviour/endpoints changed.
