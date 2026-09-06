# Auth Testing Playbook (Mukman Portal)

## MongoDB verification
```
mongosh
use test_database
db.users.find({role: "admin"})
db.users.findOne({role: "admin"}, {password_hash: 1})
```
Verify: bcrypt hash starts with `$2b$`, unique index on users.email.

## API testing
```
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
curl -c /tmp/c.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"identifier":"mukman.technologies@gmail.com","password":"Mukman@2026"}'
curl -b /tmp/c.txt $API/api/auth/me
```
Login should return the user object and set an `access_token` httpOnly cookie. /me returns the same user.

Login also works with phone: {"identifier":"9000000002","password":"Mukman@123"} (Abhimanyu).

## Cron endpoints
Require `Authorization: Bearer $WEBHOOK_CRON_SECRET` (see backend/.env). Must 401 without it.
