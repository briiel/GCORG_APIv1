# Schema Compatibility Fix Summary

## Problem Identified

The initial RBAC implementation assumed a unified `Users` table that didn't exist in the current database. The existing schema uses separate tables:
- `students` (with `id` as VARCHAR student ID)
- `student_organizations` (with `id` as INT)
- `osws_admins` (with `id` as INT)

This caused login failures with error: **"Table 'gcorganizedb_new.users' doesn't exist"**

## Solution Applied

### 1. Updated Authentication Controller (`authController.js`)

**Changes:**
- `login()` now checks all three legacy tables sequentially
- Returns different `userId` prefixes: `S_` (student), `O_` (org), `A_` (admin)
- Maps legacy user types to roles:
  - Students → `["Student"]`
  - Organization accounts → `["OrgOfficer"]`
  - Admins → `["OSWSAdmin"]`
- Checks `OrganizationMembers` table to see if student is also an officer
- Student officers get `["Student", "OrgOfficer"]` roles

**JWT Payload Structure:**
```javascript
{
  userId: "S_202211223",      // Prefixed composite key
  legacyId: "202211223",      // Original ID from legacy table
  studentId: "202211223",     // Only for students
  email: "...",
  firstName: "...",
  lastName: "...",
  roles: ["Student"],         // Dynamic based on table membership
  organization: {             // Only if OrgOfficer role
    org_id: 1,
    org_name: "GCCCS ELITES",
    position: "Vice President"
  },
  userType: "student"         // Legacy table identifier
}
```

**Changes to `register()`:**
- Accepts `student_id` as required field
- Inserts directly into `students` table
- Uses `password_hash` column (not `password`)
- Validates Gordon College email format: `202211223@gordoncollege.edu.ph`

### 2. Updated Role Request Controller (`roleRequestController.js`)

**Changes:**
- All functions now use `student_id` instead of `user_id`
- References legacy tables: `students`, `student_organizations`, `osws_admins`
- `submitRoleRequest()`: Only students can submit (checks `req.user.studentId`)
- `approveRequest()`: Uses `reviewed_by_admin_id` instead of `reviewed_by_user_id`
- Removed dependency on `UserRoles` table
- Role assignment is now determined by `OrganizationMembers` table membership

**Transactional Approval Process:**
```javascript
// 1. Lock the request with FOR UPDATE
// 2. Verify status is "pending"
// 3. Update request to "approved"
// 4. Insert into OrganizationMembers table
// 5. Commit transaction
```

### 3. Updated Migration SQL (`rbac_implementation.sql`)

**Removed:**
- `UserRoles` junction table (not needed with legacy schema)
- `Users` table references
- `Organizations` table references

**Updated Tables:**

#### `OrganizationMembers`
```sql
CREATE TABLE OrganizationMembers (
  member_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,  -- References students.id
  org_id INT NOT NULL,               -- References student_organizations.id
  position VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  added_by_admin_id INT NULL,        -- References osws_admins.id
  
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (org_id) REFERENCES student_organizations(id),
  FOREIGN KEY (added_by_admin_id) REFERENCES osws_admins(id)
);
```

#### `OrganizationRoleRequests`
```sql
CREATE TABLE OrganizationRoleRequests (
  request_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,   -- References students.id
  org_id INT NOT NULL,                -- References student_organizations.id
  requested_position VARCHAR(100) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  reviewed_by_admin_id INT NULL,     -- References osws_admins.id
  
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (org_id) REFERENCES student_organizations(id),
  FOREIGN KEY (reviewed_by_admin_id) REFERENCES osws_admins(id)
);
```

**Kept:**
- `Roles` table with 3 default roles (Student, OrgOfficer, OSWSAdmin)
- `users_unified` VIEW for potential future use

### 4. Environment Configuration (`.env`)

**Added:**
```
JWT_SECRET=e4fed2c467b43bd4a4e34e88e75553a0847f3a9cb9597ac11b8f21f3e255c08728859fb3b5401bae6715cbea92f5f9d434ed0d3dc10d24262ff9e1776c819cd5
JWT_EXPIRES_IN=24h
```

Secure 128-character hex key for production JWT signing.

## How Role Assignment Works Now

### Student Login
1. Query `students` table by email
2. Check `OrganizationMembers` for active membership
3. If no membership → roles = `["Student"]`
4. If active member → roles = `["Student", "OrgOfficer"]`

### Organization Account Login (Legacy)
1. Query `student_organizations` table by email
2. Automatically assign → roles = `["OrgOfficer"]`
3. Include organization info in JWT

### Admin Login
1. Query `osws_admins` table by email
2. Automatically assign → roles = `["OSWSAdmin"]`

## Database Flow

### Role Request Workflow

```
1. Student submits request
   ↓
   INSERT INTO OrganizationRoleRequests (student_id, org_id, requested_position, status='pending')

2. Admin reviews in queue
   ↓
   SELECT * FROM OrganizationRoleRequests WHERE status='pending'

3. Admin approves
   ↓
   BEGIN TRANSACTION
     UPDATE OrganizationRoleRequests SET status='approved', reviewed_by_admin_id=?, reviewed_at=NOW()
     INSERT INTO OrganizationMembers (student_id, org_id, position, is_active=TRUE)
   COMMIT

4. Student logs in again
   ↓
   Query: SELECT * FROM OrganizationMembers WHERE student_id=? AND is_active=TRUE
   Result: roles = ["Student", "OrgOfficer"]
```

## Middleware Updates

### `checkAuth.js`
- No changes needed
- Still verifies JWT signature
- Attaches `req.user` with decoded payload

### `checkRole.js`
- No changes needed
- Still checks `req.user.roles.some(role => allowedRoles.includes(role))`

## Frontend Compatibility

The Angular `rbac-auth.service.ts` works with the new JWT structure:

```typescript
// Decodes JWT to get roles
getDecodedToken(): JwtPayload | null {
  const token = this.getToken();
  if (!token) return null;
  return jwtDecode<JwtPayload>(token);
}

// Helper methods
isStudent(): boolean {
  return this.hasAnyRole(['Student']);
}

isOrgOfficer(): boolean {
  return this.hasAnyRole(['OrgOfficer']);
}

isAdmin(): boolean {
  return this.hasAnyRole(['OSWSAdmin']);
}
```

The navbar component shows links based on these helpers:
```html
<a *ngIf="isStudent()" routerLink="/student-panel">Student Panel</a>
<a *ngIf="isOrgOfficer()" routerLink="/org-panel">Org Panel</a>
<a *ngIf="isAdmin()" routerLink="/admin-panel">Admin Panel</a>
```

## Testing Checklist

- [x] Student can login with existing account
- [x] Student can register new account
- [x] Student can submit role request
- [x] Admin can view pending requests
- [x] Admin can approve request (transactional)
- [x] Approved student gets OrgOfficer role on next login
- [x] Multi-role navbar displays correctly
- [x] Role guard blocks unauthorized access

## Migration Steps for Production

1. Backup current database
2. Run `rbac_implementation.sql` to create new tables
3. Verify tables created: `Roles`, `OrganizationMembers`, `OrganizationRoleRequests`
4. Create admin accounts in `osws_admins` table
5. Test login with existing student accounts
6. Disable shared organization email logins
7. Notify officers to request roles through new system

## Files Modified

### Backend
- `src/controllers/authController.js` - Complete rewrite for legacy schema
- `src/controllers/roleRequestController.js` - Updated all queries
- `migrations/rbac_implementation.sql` - Removed UserRoles, updated foreign keys
- `.env` - Added secure JWT_SECRET

### Frontend (No changes needed)
- `services/rbac-auth.service.ts` - Already compatible
- `guards/role.guard.ts` - Already compatible
- `navbar/navbar.component.*` - Already compatible
- `request-role/request-role.component.*` - Already compatible
- `request-queue/request-queue.component.*` - Already compatible

### Documentation
- `RBAC_TESTING_GUIDE.md` - Complete testing instructions
- `SCHEMA_COMPATIBILITY_FIX.md` - This document

## Security Improvements

1. **Individual Authentication**: Every user now logs in with personal email
2. **JWT Tokens**: 24-hour expiration with secure 128-char secret
3. **Role-Based Access**: Middleware enforces permissions per endpoint
4. **Audit Trail**: All role requests include `reviewed_by_admin_id` and `review_notes`
5. **Transaction Safety**: Approval process uses database transactions
6. **Password Hashing**: bcrypt with salt rounds (already in existing tables)

## Next Development Tasks

1. **Data Migration Script**: Move existing officers to `OrganizationMembers` table
2. **Email Notifications**: Notify students when requests are approved/rejected
3. **Batch Approval**: Allow admins to approve multiple requests at once
4. **Role Expiration**: Implement `term_start` and `term_end` for officer positions
5. **Position Limits**: Prevent multiple students from having same position in one org
6. **Request History**: Allow students to see all their past requests (not just active ones)

## Conclusion

The RBAC system is now fully compatible with the existing database schema. No data migration is required for students, organizations, or admins. The system seamlessly integrates with legacy tables while providing modern JWT-based authentication and role management.
