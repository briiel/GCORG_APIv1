/**
 * Authentication Controller
 * Handles user authentication with RBAC support
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { handleSuccessResponse, handleErrorResponse } = require('../utils/errorHandler');

/**
 * Login with personal email (RBAC-enabled)
 * Only authenticates individual users from Users table
 * Returns JWT with roles and organization info
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return handleErrorResponse(res, 'Email and password are required.', 400);
  }

  try {
    let user = null;
    let userType = null;
    let userId = null;
    let studentId = null;

    // Step 1: Check students table first
    const [students] = await db.query(
      `SELECT id, email, password_hash, first_name, last_name 
       FROM students 
       WHERE email = ? 
       LIMIT 1`,
      [email]
    );

    if (students.length > 0) {
      user = students[0];
      userType = 'student';
      userId = `S_${user.id}`;
      studentId = user.id;
    } else {
      // Check osws_admins table
      const [admins] = await db.query(
        `SELECT id, email, password_hash, name 
         FROM osws_admins 
         WHERE email = ? 
         LIMIT 1`,
        [email]
      );

      if (admins.length > 0) {
        user = admins[0];
        userType = 'admin';
        userId = `A_${user.id}`;
        user.first_name = user.name;
        user.last_name = '';
      }
    }

    if (!user) {
      return handleErrorResponse(res, 'Invalid credentials. Please check your email and password.', 401);
    }

    // Step 2: Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return handleErrorResponse(res, 'Invalid credentials. Please check your email and password.', 401);
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

    // Step 7: Return success response
    return res.status(200).json({
      success: true,
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
    });

  } catch (error) {
    console.error('Login error:', error);
    return handleErrorResponse(res, 'An error occurred during login. Please try again.');
  }
};

/**
 * Register new user (student)
 * Automatically assigns "Student" role
 */
const register = async (req, res) => {
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
    return handleErrorResponse(res, 'Student ID, email, password, first name, and last name are required.', 400);
  }

  // Validate email format (must be Gordon College email)
  const emailRegex = /^[0-9]{9}@gordoncollege\.edu\.ph$/;
  if (!emailRegex.test(email)) {
    return handleErrorResponse(res, 'Email must be a valid Gordon College email (format: 202211223@gordoncollege.edu.ph).', 400);
  }

  // Validate student ID format
  if (!/^[0-9]{9}$/.test(student_id)) {
    return handleErrorResponse(res, 'Student ID must be 9 digits.', 400);
  }

  try {
    // Check if student ID already exists
    const [existingById] = await db.query(
      `SELECT id FROM students WHERE id = ? LIMIT 1`,
      [student_id]
    );

    if (existingById.length > 0) {
      return handleErrorResponse(res, 'A student with this ID already exists.', 409);
    }

    // Check if email already exists
    const [existingByEmail] = await db.query(
      `SELECT id FROM students WHERE email = ? LIMIT 1`,
      [email]
    );

    if (existingByEmail.length > 0) {
      return handleErrorResponse(res, 'This email is already registered.', 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into students table
    await db.query(
      `INSERT INTO students 
       (id, email, password_hash, first_name, last_name, middle_initial, suffix, department, program) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_id, email, hashedPassword, first_name, last_name, middle_initial || null, suffix || null, department || null, program || null]
    );

    return handleSuccessResponse(res, { message: 'Student account created successfully. You can now log in.' }, 201);

  } catch (error) {
    console.error('Registration error:', error);
    return handleErrorResponse(res, 'An error occurred during registration. Please try again.');
  }
};

/**
 * Verify token (for frontend authentication checks)
 */
const verifyToken = async (req, res) => {
  // If we reach here, checkAuth middleware has already verified the token
  return handleSuccessResponse(res, { message: 'Token is valid.', user: req.user });
};

/**
 * Accept data privacy policy
 * Records that the student has accepted the privacy policy
 */
const acceptPrivacyPolicy = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return handleErrorResponse(res, 'Authentication required', 401);
    }

    // Only students can accept privacy policy
    const studentId = user.studentId || user.legacyId || user.id;
    if (!studentId) {
      return handleErrorResponse(res, 'Student ID not found', 400);
    }

    // Update student record to mark privacy policy as accepted
    await db.query(
      `UPDATE students 
       SET privacy_policy_accepted = 1, 
           privacy_policy_accepted_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [studentId]
    );

    return handleSuccessResponse(res, { 
      message: 'Privacy policy acceptance recorded successfully.' 
    });

  } catch (error) {
    console.error('Accept privacy policy error:', error);
    return handleErrorResponse(res, 'An error occurred while recording privacy policy acceptance.');
  }
};

module.exports = {
  login,
  register,
  verifyToken,
  acceptPrivacyPolicy
};
