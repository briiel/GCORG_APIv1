# RBAC Testing Guide

## Prerequisites

1. **Start XAMPP**
   - Start Apache and MySQL services
   - Verify MySQL is running on port 3306

2. **Run Migration**
   ```bash
   # Connect to MySQL
   mysql -u root -p
   
   # Select the database
   USE gcorganizedb_new;
   
   # Run the migration file
   SOURCE c:/xampp/htdocs/capstone/GCORG_APIv1/migrations/rbac_implementation.sql;
   
   # Verify tables were created
   SHOW TABLES;
   ```

3. **Install Dependencies**
   ```bash
   cd c:/xampp/htdocs/capstone/GCORG_APIv1
   npm install
   ```

4. **Start Backend Server**
   ```bash
   npm start
   ```
   Server should start on `http://localhost:3000`

## Database Setup

### Verify Migration Success

```sql
-- Check that RBAC tables exist
SHOW TABLES LIKE 'Organization%';
SHOW TABLES LIKE 'Roles';

-- Should see:
-- - Roles
-- - OrganizationMembers
-- - OrganizationRoleRequests

-- Check Roles table
SELECT * FROM Roles;
-- Should show: Student, OrgOfficer, OSWSAdmin
```

### Test Data Setup

The database already has test students. Verify:

```sql
-- Check existing students
SELECT id, email, first_name, last_name FROM students;
-- Expected: 202211223, 202210888, 202210212

-- Check organizations
SELECT id, org_name, email FROM student_organizations;
-- Expected: GCCCS ELITES, GCCBA JPIA, GCCEAS IONS

-- Check admins
SELECT id, email, name FROM osws_admins;
```

### Create Test Admin (if needed)

```sql
-- Create admin account with bcrypt hashed password "admin123"
INSERT INTO osws_admins (email, password_hash, name, department) 
VALUES (
  'admin@gordoncollege.edu.ph',
  '$2b$10$YCwAqP5wHWGFW5nG5G5GqelGGhTnG5GGGGGGGGGGGGGGGGGGGGGGGG',
  'Test Admin',
  'OSWS'
);
```

## Testing Endpoints with Postman

### 1. Student Login (Existing Account)

**Endpoint:** `POST http://localhost:3000/api/auth/login`

**Body (JSON):**
```json
{
  "email": "202211223@gordoncollege.edu.ph",
  "password": "existing_password_here"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "S_202211223",
    "email": "202211223@gordoncollege.edu.ph",
    "firstName": "Brian Gabriel",
    "lastName": "Gonzales",
    "roles": ["Student"],
    "organization": null
  }
}
```

**Save the token** - You'll need it for authenticated requests!

### 2. Student Registration (New Account)

**Endpoint:** `POST http://localhost:3000/api/auth/register`

**Body (JSON):**
```json
{
  "student_id": "202299999",
  "email": "202299999@gordoncollege.edu.ph",
  "password": "TestPass123!",
  "first_name": "Test",
  "last_name": "Student",
  "department": "CCS",
  "program": "BSIT"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Student account created successfully. You can now log in."
}
```

### 3. Verify Token

**Endpoint:** `GET http://localhost:3000/api/auth/verify`

**Headers:**
```
Authorization: Bearer <your_token_here>
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Token is valid.",
  "user": {
    "userId": "S_202211223",
    "email": "202211223@gordoncollege.edu.ph",
    "roles": ["Student"],
    ...
  }
}
```

### 4. Submit Role Request (Student Only)

**Endpoint:** `POST http://localhost:3000/api/roles/request`

**Headers:**
```
Authorization: Bearer <student_token>
```

**Body (JSON):**
```json
{
  "org_id": 1,
  "requested_position": "Vice President",
  "justification": "I have experience in event management and want to contribute to the organization."
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Role request submitted successfully. Please wait for admin approval."
}
```

### 5. Get My Requests (Student)

**Endpoint:** `GET http://localhost:3000/api/roles/my-requests`

**Headers:**
```
Authorization: Bearer <student_token>
```

**Expected Response:**
```json
{
  "success": true,
  "requests": [
    {
      "request_id": 1,
      "org_id": 1,
      "requested_position": "Vice President",
      "status": "pending",
      "org_name": "GCCCS ELITES",
      ...
    }
  ]
}
```

### 6. Admin Login

**Endpoint:** `POST http://localhost:3000/api/auth/login`

**Body (JSON):**
```json
{
  "email": "admin@gordoncollege.edu.ph",
  "password": "admin123"
}
```

**Expected Response:**
```json
{
  "success": true,
  "token": "...",
  "user": {
    "userId": "A_1",
    "roles": ["OSWSAdmin"],
    ...
  }
}
```

### 7. Get Pending Requests (Admin Only)

**Endpoint:** `GET http://localhost:3000/api/admin/requests/pending`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Expected Response:**
```json
{
  "success": true,
  "requests": [
    {
      "request_id": 1,
      "student_id": "202211223",
      "org_id": 1,
      "requested_position": "Vice President",
      "first_name": "Brian Gabriel",
      "last_name": "Gonzales",
      "org_name": "GCCCS ELITES",
      ...
    }
  ]
}
```

### 8. Approve Request (Admin Only)

**Endpoint:** `POST http://localhost:3000/api/admin/approve/:requestId`

Example: `POST http://localhost:3000/api/admin/approve/1`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Body (JSON):**
```json
{
  "review_notes": "Approved based on qualifications and experience."
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Role request approved successfully."
}
```

**What happens:**
- Request status changes to "approved"
- Student is added to `OrganizationMembers` table
- Student's next login will include "OrgOfficer" role

### 9. Reject Request (Admin Only)

**Endpoint:** `POST http://localhost:3000/api/admin/reject/:requestId`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Body (JSON):**
```json
{
  "review_notes": "Request denied due to incomplete application."
}
```

## Verification Queries

### Check Request Status
```sql
SELECT 
  orr.request_id,
  orr.student_id,
  s.first_name,
  s.last_name,
  o.org_name,
  orr.requested_position,
  orr.status,
  orr.review_notes
FROM OrganizationRoleRequests orr
JOIN students s ON orr.student_id = s.id
JOIN student_organizations o ON orr.org_id = o.id;
```

### Check Organization Members
```sql
SELECT 
  om.member_id,
  om.student_id,
  s.first_name,
  s.last_name,
  o.org_name,
  om.position,
  om.is_active
FROM OrganizationMembers om
JOIN students s ON om.student_id = s.id
JOIN student_organizations o ON om.org_id = o.id;
```

### Verify Student is Now an Officer
```sql
-- After approval, this should return the student
SELECT * FROM OrganizationMembers 
WHERE student_id = '202211223' AND is_active = TRUE;
```

## Frontend Testing (Angular)

### 1. Install Frontend Dependencies

```bash
cd c:/xampp/htdocs/capstone/gc_organize
npm install jwt-decode@4.0.0
```

### 2. Start Angular Dev Server

```bash
ng serve
```

Access at `http://localhost:4200`

### 3. Test Login Flow

1. Navigate to login page
2. Enter student credentials
3. Should redirect to Student Dashboard
4. Check navbar - should show "Student Panel" link

### 4. Test Role Request

1. Login as student
2. Navigate to "Request Role" component
3. Select organization and position
4. Submit request
5. Check "My Requests" table - should show "pending"

### 5. Test Admin Approval

1. Logout student
2. Login as admin
3. Navigate to "Request Queue"
4. See pending request
5. Click "Approve" with review notes
6. Verify request disappears from queue

### 6. Test Multi-Role UX

1. Logout admin
2. Login as the approved student
3. Check navbar - should now show BOTH:
   - "Student Panel"
   - "Org Panel"
4. Navigate between panels - should persist

## Common Issues

### Error: "Table 'Users' doesn't exist"
- **Cause:** Migration not run or controller still using old schema
- **Fix:** Run migration SQL, verify authController.js uses `students`, `student_organizations`, `osws_admins`

### Error: "JWT_SECRET is not defined"
- **Cause:** Missing environment variable
- **Fix:** Check `.env` file has `JWT_SECRET` set

### Error: "Invalid credentials"
- **Cause:** Wrong password or user doesn't exist
- **Fix:** Verify user exists in database, check password is hashed with bcrypt

### Token Expired
- **Cause:** JWT expired (default 24h)
- **Fix:** Login again to get new token

## Success Criteria

✅ Student can register with Gordon College email  
✅ Student can login and receive JWT with ["Student"] role  
✅ Student can submit role request  
✅ Admin can view pending requests  
✅ Admin can approve/reject requests (transactional)  
✅ Approved student's next login includes ["Student", "OrgOfficer"] roles  
✅ Navbar shows all accessible panels  
✅ Role guard blocks unauthorized routes  

## Next Steps

After successful testing:
1. Disable all shared organization email accounts
2. Notify existing officers to create personal accounts
3. Migrate existing officer data to new RBAC system
4. Deploy to production environment
