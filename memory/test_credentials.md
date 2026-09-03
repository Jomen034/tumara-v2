# Test Credentials — Nusa (Personal AI Finance CFO)

## Authentication: Emergent-managed Google OAuth
No app-managed passwords. To test auth-gated flows, create a test user + session directly in MongoDB.

Database: `fincfo_db`
Collections: `users` (field: `user_id`), `user_sessions` (fields: `user_id`, `session_token`, `expires_at`)

### Create test session (mongosh)
```
mongosh --eval "
use('fincfo_db');
var userId = 'user_testcfo01';
var token = 'test_session_cfo_001';
db.users.updateOne({user_id:userId},{ \$set:{ user_id:userId, email:'test.cfo@example.com', name:'Test CFO', picture:'https://api.dicebear.com/7.x/notionists/svg?seed=cfo', onboarded:false, created_at:new Date() }},{upsert:true});
db.user_sessions.updateOne({session_token:token},{ \$set:{ user_id:userId, session_token:token, expires_at:new Date(Date.now()+7*24*60*60*1000), created_at:new Date() }},{upsert:true});
print('token='+token+' user='+userId);
"
```

- Bearer token for API: `Authorization: Bearer test_session_cfo_001`
- Browser cookie: name `session_token`, value `test_session_cfo_001` (httpOnly, secure, sameSite None, path /)

## Notes
- Backend base: `${REACT_APP_BACKEND_URL}/api`
- All protected endpoints require the session (cookie or Bearer).

## Household test users (Round 3)
- Admin: user_id=user_testcfo01, session_token=test_session_cfo_001 (household owner/admin).
- Partner: user_id=user_wife01, session_token=sess_wife (name "Sarah") — joined admin's household as partner.
- To reset for a fresh invite/join test:
  mongosh --eval "use('fincfo_db'); db.users.updateOne({user_id:'user_wife01'},{\$set:{household_id:null,role:'admin',onboarded:false}}); db.household_invites.deleteMany({});"
- Household cap = 2 active members (admin + partner). New endpoints under /api/household and /api/bills. CSV: GET /api/transactions/export, POST /api/transactions/import.
