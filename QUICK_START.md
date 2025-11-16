# 🚀 Quick Start Guide - RBAC System

## 5-Minute Setup

### Step 1: Database Migration
```bash
# Open MySQL command line
mysql -u root -p

# Run migration
USE gcorganizedb_new;
SOURCE c:/xampp/htdocs/capstone/GCORG_APIv1/migrations/rbac_implementation.sql;
SHOW TABLES;  # Verify Roles, OrganizationMembers, OrganizationRoleRequests exist
EXIT;
```

### Step 2: Create Admin Account
```bash
# Generate password hash for "admin123"
cd c:/xampp/htdocs/capstone/GCORG_APIv1
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10, (err, hash) => console.log(hash));"

# Copy the hash output, then run:
mysql -u root -p
USE gcorganizedb_new;

# Insert admin (replace <HASH> with output from above)
INSERT INTO osws_admins (email, password_hash, name, department) 
VALUES ('admin@gordoncollege.edu.ph', '<HASH>', 'Test Admin', 'OSWS');
EXIT;
```

### Step 3: Start Backend
```bash
cd c:/xampp/htdocs/capstone/GCORG_APIv1
npm install   # First time only
npm start
```

Expected output:
```
Server running on port 3000
Database connected successfully
```

### Step 4: Install Frontend Dependency
```bash
cd c:/xampp/htdocs/capstone/gc_organize
npm install jwt-decode@4.0.0
```

### Step 5: Start Frontend
```bash
ng serve
```

Access at: `http://localhost:4200`

---

## First Test (2 Minutes)

### Test 1: Student Login

**Using Postman or curl:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "202211223@gordoncollege.edu.ph",
    "password": "existing_password_here"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "userId": "S_202211223",
    "email": "202211223@gordoncollege.edu.ph",
    "firstName": "Brian Gabriel",
    "lastName": "Gonzales",
    "roles": ["Student"]
  }
}
```

✅ **Success!** Copy the token for next steps.

### Test 2: Submit Role Request

```bash
curl -X POST http://localhost:3000/api/roles/request \
  -H "Authorization: Bearer <PASTE_TOKEN_HERE>" \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": 1,
    "requested_position": "Vice President",
    "justification": "I have leadership experience."
  }'
```

**Expected:**
```json
{
  "success": true,
  "message": "Role request submitted successfully."
}
```

### Test 3: Admin Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@gordoncollege.edu.ph",
    "password": "admin123"
  }'
```

**Expected:**
```json
{
  "success": true,
  "token": "...",
  "user": {
    "roles": ["OSWSAdmin"]
  }
}
```

✅ **Copy admin token**

### Test 4: Approve Request

```bash
curl -X POST http://localhost:3000/api/admin/approve/1 \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"review_notes": "Approved for testing"}'
```

**Expected:**
```json
{
  "success": true,
  "message": "Role request approved successfully."
}
```

### Test 5: Verify Multi-Role

Re-login as student:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "202211223@gordoncollege.edu.ph",
    "password": "existing_password_here"
  }'
```

**Expected:**
```json
{
  "user": {
    "roles": ["Student", "OrgOfficer"],
    "organization": {
      "org_id": 1,
      "org_name": "GCCCS ELITES",
      "position": "Vice President"
    }
  }
}
```

✅ **Multi-role access working!**

---

## Frontend Test (2 Minutes)

1. Open browser: `http://localhost:4200`
2. Login with student credentials
3. Check navbar → Should show "Student Panel"
4. Navigate to "Request Role" (if visible)
5. Logout, login as admin
6. Navigate to "Request Queue"
7. Approve a request
8. Logout, re-login as approved student
9. Check navbar → Should show BOTH "Student Panel" AND "Org Panel"

✅ **Multi-role UX working!**

---

## Troubleshooting

### "Table doesn't exist"
```bash
# Re-run migration
mysql -u root -p
USE gcorganizedb_new;
SOURCE c:/xampp/htdocs/capstone/GCORG_APIv1/migrations/rbac_implementation.sql;
```

### "Invalid credentials"
```bash
# Check if student exists
mysql -u root -p
USE gcorganizedb_new;
SELECT id, email FROM students WHERE email = '202211223@gordoncollege.edu.ph';
```

### "JWT_SECRET is not defined"
Check `.env` file has:
```
JWT_SECRET=e4fed2c467b43bd4a4e34e88e75553a0847f3a9cb9597ac11b8f21f3e255c08728859fb3b5401bae6715cbea92f5f9d434ed0d3dc10d24262ff9e1776c819cd5
```

### "Cannot find module 'jwt-decode'"
```bash
cd gc_organize
npm install jwt-decode@4.0.0
```

---

## What's Next?

1. ✅ Basic tests passing? → Read `RBAC_TESTING_GUIDE.md` for comprehensive testing
2. ✅ Ready to deploy? → Follow `DEPLOYMENT_CHECKLIST.md` (33 steps)
3. ✅ Need API reference? → See `API_ENDPOINTS_REFERENCE.md`
4. ✅ Want technical details? → Read `SCHEMA_COMPATIBILITY_FIX.md`

---

## Key Files

```
GCORG_APIv1/
├── FINAL_SUMMARY.md              ← Overview of everything
├── QUICK_START.md                ← This file (5-min setup)
├── RBAC_TESTING_GUIDE.md         ← Comprehensive tests
├── DEPLOYMENT_CHECKLIST.md       ← 33-step deployment
├── API_ENDPOINTS_REFERENCE.md    ← API quick reference
├── SCHEMA_COMPATIBILITY_FIX.md   ← Technical details
├── migrations/
│   └── rbac_implementation.sql   ← Database migration
└── src/
    └── controllers/
        ├── authController.js     ← Login/register
        └── roleRequestController.js  ← Role requests
```

---

## Success Criteria

✅ Student can login with Gordon College email  
✅ Student can submit role request  
✅ Admin can approve request  
✅ Approved student gets multi-role access  
✅ Navbar shows all accessible panels  

**All working?** → You're ready for production! 🎉

---

**Total Setup Time:** ~10 minutes  
**Testing Time:** ~5 minutes  
**Documentation:** 9 comprehensive guides available

Need help? Check the guides above or review `FINAL_SUMMARY.md` for detailed info!
