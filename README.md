# GCORG_APIv1 - GC-ORGANIZE Backend API

Backend API for GC-ORGANIZE event management system with **Role-Based Access Control (RBAC)**.

## ⚡ Quick Start

**NEW TO RBAC?** → Read [`QUICK_START.md`](QUICK_START.md) for 5-minute setup guide!

**DEPLOYING?** → Follow [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) (33 steps)

**COMPLETE OVERVIEW?** → See [`FINAL_SUMMARY.md`](FINAL_SUMMARY.md)

---

## 🎯 What's New: RBAC Implementation

### Secure Individual-Based Authentication
- ✅ All users now login with **personal Gordon College emails**
- ✅ Shared organization passwords **disabled**
- ✅ JWT-based authentication with 24-hour expiration
- ✅ Role-based access control (Student, OrgOfficer, OSWSAdmin)
- ✅ Request & Approve workflow for officer promotions
- ✅ Multi-role user experience with persistent navigation

### API Endpoints

#### Authentication
```
POST   /api/auth/login              Login (returns JWT)
POST   /api/auth/register           Register new student
GET    /api/auth/verify             Verify token validity
```

#### Role Requests (Students)
```
POST   /api/roles/request           Submit role request
GET    /api/roles/my-requests       View my requests
```

#### Admin Management
```
GET    /api/admin/requests/pending  View pending requests
GET    /api/admin/requests          View all requests (with filter)
POST   /api/admin/approve/:id       Approve request (transactional)
POST   /api/admin/reject/:id        Reject request
```

For full API reference: [`API_ENDPOINTS_REFERENCE.md`](API_ENDPOINTS_REFERENCE.md)

---

## 📦 Getting Started

### 1. Install Dependencies
```bash
npm install
```

Required packages:
- `jsonwebtoken` - JWT creation/verification
- `bcrypt` - Password hashing
- `mysql2` - Database driver
- `express` - Web framework

### 2. Database Setup

Run the RBAC migration:
```bash
mysql -u root -p
USE gcorganizedb_new;
SOURCE c:/xampp/htdocs/capstone/GCORG_APIv1/migrations/rbac_implementation.sql;
```

Creates 3 new tables:
- `Roles` - Student, OrgOfficer, OSWSAdmin
- `OrganizationMembers` - Student→Organization mapping
- `OrganizationRoleRequests` - Request & Approve workflow

### 3. Environment Configuration

Create/update `.env` file:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=gcorganizedb_new
PORT=3000

# RBAC Configuration
JWT_SECRET=your_secure_128_character_secret_key_here
JWT_EXPIRES_IN=24h
```

**⚠️ IMPORTANT:** Generate a secure JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Create Admin Account

```bash
cd scripts
node create_admin_user.js
```

Or manually:
```bash
# Generate password hash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10, (err, hash) => console.log(hash));"

# Insert into database
mysql -u root -p
USE gcorganizedb_new;
INSERT INTO osws_admins (email, password_hash, name, department) 
VALUES ('admin@gordoncollege.edu.ph', '<HASH>', 'Admin Name', 'OSWS');
```

### 5. Start Server

Development (auto-restart):
```bash
npm run dev
```

Production:
```bash
npm start
```

Server runs on: `http://localhost:3000`

---

## 🔐 Authentication & Authorization

### How It Works

1. **User logs in** → POST `/api/auth/login` with email/password
2. **Server returns JWT** → Contains userId, email, roles array
3. **Client stores token** → localStorage or sessionStorage
4. **Protected requests** → Include `Authorization: Bearer <token>` header
5. **Middleware verifies** → `checkAuth` validates JWT, `checkRole` checks permissions

### Token Structure
```json
{
  "userId": "S_202211223",
  "studentId": "202211223",
  "email": "202211223@gordoncollege.edu.ph",
  "firstName": "Brian Gabriel",
  "lastName": "Gonzales",
  "roles": ["Student", "OrgOfficer"],
  "organization": {
    "org_id": 1,
    "org_name": "GCCCS ELITES",
    "position": "Vice President"
  },
  "exp": 1705495200
}
```

### Role Hierarchy
- **Student** - Regular Gordon College students
- **OrgOfficer** - Approved organization officers (also students)
- **OSWSAdmin** - OSWS administrators with full access

---

## 🧪 Testing

### Quick Test with curl

**Student Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"202211223@gordoncollege.edu.ph","password":"password123"}'
```

**Submit Role Request:**
```bash
curl -X POST http://localhost:3000/api/roles/request \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"org_id":1,"requested_position":"Vice President","justification":"I have experience..."}'
```

**Admin Approval:**
```bash
curl -X POST http://localhost:3000/api/admin/approve/1 \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"review_notes":"Approved based on qualifications."}'
```

For comprehensive testing: [`RBAC_TESTING_GUIDE.md`](RBAC_TESTING_GUIDE.md)

---

## 📚 Documentation

### Essential Guides
1. **[FINAL_SUMMARY.md](FINAL_SUMMARY.md)** ⭐ - Complete overview, start here!
2. **[QUICK_START.md](QUICK_START.md)** ⭐ - 5-minute setup guide
3. **[RBAC_TESTING_GUIDE.md](RBAC_TESTING_GUIDE.md)** - Comprehensive testing
4. **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - 33-step deployment
5. **[API_ENDPOINTS_REFERENCE.md](API_ENDPOINTS_REFERENCE.md)** - API quick reference
6. **[SCHEMA_COMPATIBILITY_FIX.md](SCHEMA_COMPATIBILITY_FIX.md)** - Technical details

### Root Documentation
- **[RBAC_IMPLEMENTATION_GUIDE.md](../RBAC_IMPLEMENTATION_GUIDE.md)** - Original implementation guide
- **[PACKAGE_INSTALLATION.md](../PACKAGE_INSTALLATION.md)** - Dependency setup
- **[IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md)** - High-level overview
- **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** - Complete documentation index

---

## 🗂️ Project Structure

```
GCORG_APIv1/
├── src/
│   ├── controllers/
│   │   ├── authController.js              ✨ Login, register, verify (RBAC)
│   │   ├── roleRequestController.js       ✨ Role request workflow
│   │   ├── eventController.js             Existing event management
│   │   ├── userController.js              Existing user operations
│   │   └── ...
│   ├── middleware/
│   │   ├── checkAuth.js                   ✨ JWT verification
│   │   ├── checkRole.js                   ✨ Role-based access control
│   │   └── ...
│   ├── routes/
│   │   ├── authRoutes.js                  ✨ Auth endpoints
│   │   ├── roleRequestRoutes.js           ✨ Role request endpoints
│   │   └── ...
│   ├── services/
│   ├── models/
│   └── config/
│       └── db.js                          Database connection
├── migrations/
│   └── rbac_implementation.sql            ✨ RBAC database schema
├── scripts/
│   └── create_admin_user.js               ✨ Admin creation script
└── Documentation...

✨ = New RBAC files
```

---

## 🔄 Existing Features (Unchanged)

### Events Management
- Create, update, delete events
- Event status tracking (upcoming → ongoing → completed → cancelled)
- Automatic status updates based on dates

### Notifications
- GET `/api/notifications` - List notifications
- PATCH `/api/notifications/:id/read` - Mark as read
- Registration success notifications
- Certificate request notifications

### Manual Event Status Updates
- PATCH `/api/event/events/:id/status` - Update status
- PUT `/api/event/events/:id` - Update event (includes status)
- **Rule:** Only `cancelled` status can be set manually
- **Ownership:** Only event creator can cancel

---

## 🚨 Breaking Changes

### ⚠️ Organization Email Logins Disabled

Shared organization email accounts are now **disabled** for security:
- Organization officers must use **personal Gordon College emails**
- Officers request role through `/api/roles/request`
- Admins approve via `/api/admin/approve/:id`

### Migration Path
1. Notify existing officers
2. Officers create personal accounts
3. Officers submit role requests
4. Admins approve requests
5. Officers gain OrgOfficer role

See [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) for complete migration plan.

---

## 🔒 Security

### Implemented
✅ bcrypt password hashing (10 rounds)
✅ JWT with 24-hour expiration
✅ Secure 128-character secret key
✅ Role-based middleware protection
✅ Transaction-safe role approvals
✅ Audit trail (reviewed_by_admin_id, review_notes)

### Best Practices
- Never commit `.env` to version control
- Rotate JWT_SECRET periodically
- Use HTTPS in production
- Implement rate limiting for login endpoints
- Monitor failed login attempts

---

## 🐛 Troubleshooting

### "Table 'gcorganizedb_new.users' doesn't exist"
**Cause:** Migration not run
**Fix:** Run `migrations/rbac_implementation.sql`

### "JWT_SECRET is not defined"
**Cause:** Missing environment variable
**Fix:** Add `JWT_SECRET` to `.env` file

### "Invalid credentials"
**Cause:** Wrong password or user doesn't exist
**Fix:** Verify user exists in `students`, `osws_admins`, or `student_organizations`

### "Access denied. Insufficient permissions"
**Cause:** User doesn't have required role
**Fix:** Check JWT payload roles array, verify role assignment

For more: [`QUICK_START.md`](QUICK_START.md) → Troubleshooting

---

## 📊 Database Schema

### Legacy Tables (Unchanged)
- `students` - Student accounts
- `student_organizations` - Organization accounts
- `osws_admins` - Admin accounts

### New RBAC Tables
- `Roles` - 3 default roles (Student, OrgOfficer, OSWSAdmin)
- `OrganizationMembers` - Links students to organizations with positions
- `OrganizationRoleRequests` - Request & Approve workflow tracking

### Relationships
```
students (1) ──< OrganizationMembers >── (1) student_organizations
students (1) ──< OrganizationRoleRequests >── (1) student_organizations
osws_admins (1) ──< OrganizationRoleRequests (reviewer)
```

---

## 🎯 Next Steps

1. ✅ Read [`FINAL_SUMMARY.md`](FINAL_SUMMARY.md) - 10 minutes
2. ✅ Follow [`QUICK_START.md`](QUICK_START.md) - 5 minutes
3. ✅ Run first tests - 5 minutes
4. ✅ Review [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) - 15 minutes
5. ✅ Deploy to production - 1-2 hours

---

## 📞 Support

**Issues?** Check the documentation:
- [`QUICK_START.md`](QUICK_START.md) - Quick fixes
- [`RBAC_TESTING_GUIDE.md`](RBAC_TESTING_GUIDE.md) - Common issues
- [`API_ENDPOINTS_REFERENCE.md`](API_ENDPOINTS_REFERENCE.md) - API syntax

**Need Overview?** See:
- [`FINAL_SUMMARY.md`](FINAL_SUMMARY.md) - Complete summary
- [`DOCUMENTATION_INDEX.md`](../DOCUMENTATION_INDEX.md) - All documentation

---

**Version:** RBAC v1.0  
**Status:** ✅ Production Ready  
**Last Updated:** January 16, 2025

**🚀 Ready to deploy!**