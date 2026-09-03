# Auth-Gated App Testing Playbook (Emergent Google Auth)

## Step 1: Create Test User & Session
```
mongosh --eval "
use('fincfo_db');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({ user_id: userId, email: 'test.user.' + Date.now() + '@example.com', name: 'Test User', picture: 'https://via.placeholder.com/150', created_at: new Date() });
db.user_sessions.insertOne({ user_id: userId, session_token: sessionToken, expires_at: new Date(Date.now() + 7*24*60*60*1000), created_at: new Date() });
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Backend API
```
curl -X GET "$URL/api/auth/me" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
curl -X GET "$URL/api/wallets" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Step 3: Browser
Set cookie session_token (httpOnly, secure, sameSite None, path /) then navigate to app.

## Checklist
- users doc has user_id (UUID); sessions.user_id matches user.user_id
- all queries use {"_id": 0}
- /api/auth/me returns user (not 401)
- Callback detection uses useLocation().hash
