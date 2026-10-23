# Test Credentials & Auth Architecture — Tumara

## Authentication Architecture
Tumara v2 uses an independent, self-contained authentication engine:
- **Email & Password**: Stored with secure `bcrypt` salted password hashing.
- **Access Code Activation**: Admin accounts activate via license codes (`TMR-STR-XXXXXX`, `TMR-PRO-XXXXXX`, `TMR-FAM-XXXXXX`, or legacy default `TUMARA2026`).
- **Household Partner Invites**: Partners join via household invite codes (`inv_xxxxxx`).
- **Sessions**: Multi-device support with HTTP-only cookie `session_token` and `Authorization: Bearer <token>` support.

Database: `fincfo_db`
Collections: `users`, `user_sessions`, `access_codes`, `household_invites`, `households`

## Default Admin Credentials
- Email: `jomenpardede@gmail.com`
- Role: Admin
- Tier: Pro (Lifetime)

## Notes
- Base API URL: `${REACT_APP_BACKEND_URL}/api`
- All protected endpoints require an active session token (cookie or Bearer header).
- Household cap = 2 active members (Admin + Partner).
