/**
 * Authentication Controller
 * Handles user authentication with RBAC support
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { handleSuccessResponse, handleErrorResponse } = require('../utils/errorHandler');
const asyncHandler = require('../middleware/async-handler');
const { ValidationError, AuthenticationError, DatabaseError, ConflictError } = require('../utils/error-classes');
const { encryptData, decryptData } = require('../utils/encryption');

/**
 * Login with personal email (RBAC-enabled)
 * Only authenticates individual users from Users table
 * Returns JWT with roles and organization info
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    throw new ValidationError('Email and password are required.');
  }

  let user = null;
  let userType = null;
  let userId = null;
  let studentId = null;

  // Step 1: Check students table first
  // Note: Email might be encrypted, so we need to fetch all and decrypt
  const [allStudents] = await db.query(
    `SELECT id, email, password_hash, first_name, last_name 
     FROM students 
     LIMIT 1000`
  );

  // Find matching student by decrypting emails
  let students = [];
  for (const student of allStudents) {
    try {
      let studentEmail = student.email;
      // Try to decrypt if it looks encrypted
      if (studentEmail && studentEmail.includes(':') && studentEmail.split(':').length === 3) {
        studentEmail = decryptData(studentEmail);
      }
      if (studentEmail === email) {
        student.email = studentEmail; // Use decrypted email
        students.push(student);
        break;
      }
    } catch (err) {
      // Skip if decryption fails
      continue;
    }
  }

  if (students.length > 0) {
    user = students[0];
    userType = 'student';
    userId = `S_${user.id}`;
    studentId = user.id;
  } else {
    // Check osws_admins table
    // Note: Email might be encrypted
    const [allAdmins] = await db.query(
      `SELECT id, email, password_hash, name 
       FROM osws_admins 
       LIMIT 100`
    );

    // Find matching admin by decrypting emails
    let admins = [];
    for (const admin of allAdmins) {
      try {
        let adminEmail = admin.email;
        // Try to decrypt if it looks encrypted
        if (adminEmail && adminEmail.includes(':') && adminEmail.split(':').length === 3) {
          adminEmail = decryptData(adminEmail);
        }
        if (adminEmail === email) {
          admin.email = adminEmail; // Use decrypted email
          admins.push(admin);
          break;
        }
      } catch (err) {
        // Skip if decryption fails
        continue;
      }
    }

    if (admins.length > 0) {
      user = admins[0];
      userType = 'admin';
      userId = `A_${user.id}`;
      user.first_name = user.name;
      user.last_name = '';
    }
  }

  if (!user) {
    throw new AuthenticationError('Invalid credentials. Please check your email and password.');
  }

  // Step 2: Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw new AuthenticationError('Invalid credentials. Please check your email and password.');
  }

  // Step 3: Fetch user's roles from UserRoles table
  // Map legacy user types to roles
  let roles = [];

  if (userType === 'admin') {
    roles = ['oswsadmin'];
  } else if (userType === 'student') {
    // For students, start with Student role
    roles = ['student'];

    // Check for OrgOfficer role if student has approved membership
    if (studentId) {
      const [orgMemberships] = await db.query(
        `SELECT om.org_id, om.position, o.org_name
         FROM organizationmembers om
         JOIN student_organizations o ON om.org_id = o.id
         WHERE om.student_id = ? AND om.is_active = TRUE
         LIMIT 1`,
        [studentId]
      );

      if (orgMemberships.length > 0) {
        roles.push('orgofficer');
      }
    }
  }

  // Step 4: Fetch organization info if user is an OrgOfficer
  let organization = null;

  if (roles.includes('orgofficer') && studentId) {
    const [orgMemberships] = await db.query(
      `SELECT om.org_id, om.position, o.org_name
       FROM organizationmembers om
       JOIN student_organizations o ON om.org_id = o.id
       WHERE om.student_id = ? AND om.is_active = TRUE
       LIMIT 1`,
      [studentId]
    );

    if (orgMemberships.length > 0) {
      organization = {
        org_id: orgMemberships[0].org_id,
        org_name: orgMemberships[0].org_name,
        position: orgMemberships[0].position
      };
    }
  }

  // Step 5: Create JWT payload
  const payload = {
    userId: userId,
    legacyId: user.id,
    studentId: studentId,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name || '',
    roles: roles,
    organization: organization,
    userType: userType
  };

  // Step 6: Sign JWT
  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  // Step 7: Return success response (use standard helper)
  return handleSuccessResponse(res, {
    message: 'Login successful.',
    token: token,
    user: {
      userId: userId,
      id: user.id || null,
      legacyId: user.id || null,
      studentId: studentId || null,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name || '',
      roles: roles,
      role: (roles && roles.length > 0) ? String(roles[0]).toLowerCase() : (userType || null),
      organization: organization,
      userType: userType || null
    }
  }, 200);
});

/**
 * Register new user (student)
 * Automatically assigns "Student" role
 */
const register = asyncHandler(async (req, res) => {
  const {
    student_id,
    email,
    password,
    first_name,
    last_name,
    middle_initial,
    suffix,
    department,
    program
  } = req.body;

  // Validation
  if (!student_id || !email || !password || !first_name || !last_name) {
    throw new ValidationError('Student ID, email, password, first name, and last name are required.');
  }

  // Validate email format (must be Gordon College email)
  const emailRegex = /^[0-9]{9}@gordoncollege\.edu\.ph$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Email must be a valid Gordon College email (format: 202211223@gordoncollege.edu.ph).');
  }

  // Validate student ID format
  if (!/^[0-9]{9}$/.test(student_id)) {
    throw new ValidationError('Student ID must be 9 digits.');
  }

  // Check if student ID already exists
  const [existingById] = await db.query(
    `SELECT id FROM students WHERE id = ? LIMIT 1`,
    [student_id]
  );

  if (existingById.length > 0) {
    throw new ConflictError('A student with this ID already exists.');
  }

  // Check if email already exists (need to decrypt all emails to compare)
  const [allStudents] = await db.query(
    `SELECT id, email FROM students LIMIT 1000`
  );

  // Check against decrypted emails
  for (const student of allStudents) {
    try {
      let studentEmail = student.email;
      // Try to decrypt if it looks encrypted
      if (studentEmail && studentEmail.includes(':') && studentEmail.split(':').length === 3) {
        studentEmail = decryptData(studentEmail);
      }
      if (studentEmail === email) {
        throw new ConflictError('This email is already registered.');
      }
    } catch (err) {
      // Skip if decryption fails
      continue;
    }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Encrypt sensitive data
  const encryptedEmail = encryptData(email);

  // Insert into students table
  await db.query(
    `INSERT INTO students 
       (id, email, password_hash, first_name, last_name, middle_initial, suffix, department, program) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [student_id, encryptedEmail, hashedPassword, first_name, last_name, middle_initial || null, suffix || null, department || null, program || null]
  );

  return handleSuccessResponse(res, { message: 'Student account created successfully. You can now log in.' }, 201);
});

/**
 * Verify token (for frontend authentication checks)
 */
const verifyToken = asyncHandler(async (req, res) => {
  // If we reach here, checkAuth middleware has already verified the token
  return handleSuccessResponse(res, { message: 'Token is valid.', user: req.user });
});

/**
 * Accept data privacy policy
 * Records that the student has accepted the privacy policy
 */
const acceptPrivacyPolicy = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }
  // Determine whether this is a student or an OSWS admin and update
  // the corresponding table. The JWT payload sets `userType` to
  // 'student' or 'admin' and includes `studentId` / `legacyId`.
  const userType = user.userType || null;

  if (userType === 'admin') {
    // Admin user: update osws_admins table using legacyId or id
    const adminId = user.legacyId || user.id;
    if (!adminId) {
      throw new ValidationError('Admin ID not found');
    }

    await db.query(
      `UPDATE osws_admins
         SET privacy_policy_accepted = 1,
             privacy_policy_accepted_at = UTC_TIMESTAMP()
         WHERE id = ?`,
      [adminId]
    );
  } else {
    // Default to student flow
    const studentId = user.studentId || user.legacyId || user.id;
    if (!studentId) {
      throw new ValidationError('Student ID not found');
    }

    await db.query(
      `UPDATE students 
         SET privacy_policy_accepted = 1, 
             privacy_policy_accepted_at = UTC_TIMESTAMP()
         WHERE id = ?`,
      [studentId]
    );
  }

  return handleSuccessResponse(res, {
    message: 'Privacy policy acceptance recorded successfully.'
  });
});

/**
 * Get privacy policy acceptance status for logged-in user
 */
const getPrivacyPolicyStatus = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  const userType = user.userType || null;
  let accepted = false;

  if (userType === 'admin') {
    // Check OSWS admin
    const adminId = user.legacyId || user.id;
    if (!adminId) {
      throw new ValidationError('Admin ID not found');
    }

    const [rows] = await db.query(
      'SELECT privacy_policy_accepted FROM osws_admins WHERE id = ?',
      [adminId]
    );

    accepted = rows.length > 0 && rows[0].privacy_policy_accepted === 1;
  } else {
    // Check student
    const studentId = user.studentId || user.legacyId || user.id;
    if (!studentId) {
      throw new ValidationError('Student ID not found');
    }

    const [rows] = await db.query(
      'SELECT privacy_policy_accepted FROM students WHERE id = ?',
      [studentId]
    );

    accepted = rows.length > 0 && rows[0].privacy_policy_accepted === 1;
  }

  return handleSuccessResponse(res, { accepted });
});

module.exports = {
  login,
  register,
  verifyToken,
  acceptPrivacyPolicy,
  getPrivacyPolicyStatus
};
