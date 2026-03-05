// Authentication Controller — login, register, token verification, and privacy policy

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { handleSuccessResponse, handleErrorResponse } = require('../utils/errorHandler');
const asyncHandler = require('../middleware/async-handler');
const { ValidationError, AuthenticationError, DatabaseError, ConflictError } = require('../utils/error-classes');
const { encryptData, decryptData } = require('../utils/encryption');

// Safely decrypt a field — returns original value if not encrypted or decryption fails
const safeDecrypt = (value) => {
  if (value && typeof value === 'string' && value.includes(':') && value.split(':').length === 3) {
    try { return decryptData(value); } catch { return value; }
  }
  return value;
};

// Login with personal email — authenticates students and OSWS admins, returns JWT with roles
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError('Email and password are required.');
  }

  let user = null;
  let userType = null;
  let userId = null;
  let studentId = null;

  // Check students table — email fields are encrypted, so fetch all and compare decrypted values
  const [allStudents] = await db.query(
    `SELECT id, email, password_hash, first_name, last_name FROM students LIMIT 1000`
  );

  let students = [];
  for (const student of allStudents) {
    try {
      const studentEmail = safeDecrypt(student.email);
      if (studentEmail === email) {
        student.email = studentEmail;
        student.first_name = safeDecrypt(student.first_name);
        student.last_name = safeDecrypt(student.last_name);
        students.push(student);
        break;
      }
    } catch (err) {
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
    const [allAdmins] = await db.query(
      `SELECT id, email, password_hash, name FROM osws_admins LIMIT 100`
    );

    let admins = [];
    for (const admin of allAdmins) {
      try {
        const adminEmail = safeDecrypt(admin.email);
        if (adminEmail === email) {
          admin.email = adminEmail;
          admins.push(admin);
          break;
        }
      } catch (err) {
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

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AuthenticationError('Invalid credentials. Please check your email and password.');
  }

  // Assign roles based on user type
  let roles = [];
  if (userType === 'admin') {
    roles = ['oswsadmin'];
  } else if (userType === 'student') {
    roles = ['student'];
    if (studentId) {
      const [orgMemberships] = await db.query(
        `SELECT om.org_id, om.position, o.org_name
         FROM organizationmembers om
         JOIN student_organizations o ON om.org_id = o.id
         WHERE om.student_id = ? AND om.is_active = TRUE LIMIT 1`,
        [studentId]
      );
      if (orgMemberships.length > 0) roles.push('orgofficer');
    }
  }

  // Fetch organization info for org officers
  let organization = null;
  if (roles.includes('orgofficer') && studentId) {
    const [orgMemberships] = await db.query(
      `SELECT om.org_id, om.position, o.org_name
       FROM organizationmembers om
       JOIN student_organizations o ON om.org_id = o.id
       WHERE om.student_id = ? AND om.is_active = TRUE LIMIT 1`,
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

  // Build and sign JWT
  const payload = {
    userId, legacyId: user.id, studentId, email: user.email,
    firstName: user.first_name, lastName: user.last_name || '',
    roles, organization, userType
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });

  return handleSuccessResponse(res, {
    message: 'Login successful.',
    token,
    user: {
      userId, id: user.id || null, legacyId: user.id || null,
      studentId: studentId || null, email: user.email,
      firstName: user.first_name, lastName: user.last_name || '',
      roles, role: (roles && roles.length > 0) ? String(roles[0]).toLowerCase() : (userType || null),
      organization, userType: userType || null
    }
  }, 200);
});

// Register a new student account with encrypted PII
const register = asyncHandler(async (req, res) => {
  const { student_id, email, password, first_name, last_name, middle_initial, suffix, department, program } = req.body;

  if (!student_id || !email || !password || !first_name || !last_name) {
    throw new ValidationError('Student ID, email, password, first name, and last name are required.');
  }

  // Validate Gordon College email format
  const emailRegex = /^[0-9]{9}@gordoncollege\.edu\.ph$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Email must be a valid Gordon College email (format: 202211223@gordoncollege.edu.ph).');
  }

  if (!/^[0-9]{9}$/.test(student_id)) {
    throw new ValidationError('Student ID must be 9 digits.');
  }

  // Check for duplicate student ID
  const [existingById] = await db.query(`SELECT id FROM students WHERE id = ? LIMIT 1`, [student_id]);
  if (existingById.length > 0) throw new ConflictError('A student with this ID already exists.');

  // Check for duplicate email (compare against decrypted values)
  const [allStudents] = await db.query(`SELECT id, email FROM students LIMIT 1000`);
  let emailExists = false;
  for (const student of allStudents) {
    if (safeDecrypt(student.email) === email) { emailExists = true; break; }
  }
  if (emailExists) throw new ConflictError('This email is already registered.');

  // Hash password and encrypt all sensitive fields
  const hashedPassword = await bcrypt.hash(password, 10);
  const encryptedEmail = encryptData(email);
  const encryptedFirstName = encryptData(first_name);
  const encryptedLastName = encryptData(last_name);
  const encryptedMiddleInitial = middle_initial ? encryptData(middle_initial) : null;
  const encryptedSuffix = suffix ? encryptData(suffix) : null;
  const encryptedDepartment = department ? encryptData(department) : null;
  const encryptedProgram = program ? encryptData(program) : null;

  await db.query(
    `INSERT INTO students (id, email, password_hash, first_name, last_name, middle_initial, suffix, department, program)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [student_id, encryptedEmail, hashedPassword, encryptedFirstName, encryptedLastName,
      encryptedMiddleInitial, encryptedSuffix, encryptedDepartment, encryptedProgram]
  );

  return handleSuccessResponse(res, { message: 'Student account created successfully. You can now log in.' }, 201);
});

// Verify token validity — checkAuth middleware already validated it before this runs
const verifyToken = asyncHandler(async (req, res) => {
  return handleSuccessResponse(res, { message: 'Token is valid.', user: req.user });
});

// Accept data privacy policy for the logged-in user
const acceptPrivacyPolicy = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AuthenticationError('Authentication required');

  const userType = user.userType || null;

  if (userType === 'admin') {
    const adminId = user.legacyId || user.id;
    if (!adminId) throw new ValidationError('Admin ID not found');
    await db.query(
      `UPDATE osws_admins SET privacy_policy_accepted = 1, privacy_policy_accepted_at = UTC_TIMESTAMP() WHERE id = ?`,
      [adminId]
    );
  } else {
    const studentId = user.studentId || user.legacyId || user.id;
    if (!studentId) throw new ValidationError('Student ID not found');
    await db.query(
      `UPDATE students SET privacy_policy_accepted = 1, privacy_policy_accepted_at = UTC_TIMESTAMP() WHERE id = ?`,
      [studentId]
    );
  }

  return handleSuccessResponse(res, { message: 'Privacy policy acceptance recorded successfully.' });
});

// Get privacy policy acceptance status for the logged-in user
const getPrivacyPolicyStatus = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AuthenticationError('Authentication required');

  const userType = user.userType || null;
  let accepted = false;

  if (userType === 'admin') {
    const adminId = user.legacyId || user.id;
    if (!adminId) throw new ValidationError('Admin ID not found');
    const [rows] = await db.query(
      'SELECT privacy_policy_accepted FROM osws_admins WHERE id = ?', [adminId]
    );
    accepted = rows.length > 0 && rows[0].privacy_policy_accepted === 1;
  } else {
    const studentId = user.studentId || user.legacyId || user.id;
    if (!studentId) throw new ValidationError('Student ID not found');
    const [rows] = await db.query(
      'SELECT privacy_policy_accepted FROM students WHERE id = ?', [studentId]
    );
    accepted = rows.length > 0 && rows[0].privacy_policy_accepted === 1;
  }

  return handleSuccessResponse(res, { accepted });
});

module.exports = { login, register, verifyToken, acceptPrivacyPolicy, getPrivacyPolicyStatus };
