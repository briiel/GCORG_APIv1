/**
 * Create Test Admin User
 * Run this script to create a test admin user for the RBAC system
 * 
 * Usage: node create_admin_user.js
 */

const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

const ADMIN_EMAIL = 'admin@gordoncollege.edu';
const ADMIN_PASSWORD = 'Admin123!'; // Change this!
const ADMIN_FIRST_NAME = 'OSWS';
const ADMIN_LAST_NAME = 'Administrator';

async function createAdminUser() {
  let connection;

  try {
    console.log('🔌 Connecting to database...');
    
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gcorganizedb'
    });

    console.log('✅ Connected to database\n');

    // Check if admin user already exists
    const [existingUsers] = await connection.query(
      'SELECT user_id FROM Users WHERE email = ?',
      [ADMIN_EMAIL]
    );

    if (existingUsers.length > 0) {
      console.log('⚠️  Admin user already exists with email:', ADMIN_EMAIL);
      console.log('Skipping creation...\n');
      return;
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    console.log('✅ Password hashed\n');

    // Start transaction
    await connection.beginTransaction();
    console.log('📝 Starting transaction...\n');

    // Insert admin user
    console.log('👤 Creating admin user...');
    const [insertResult] = await connection.query(
      `INSERT INTO Users 
       (email, password, first_name, last_name, user_type, is_active) 
       VALUES (?, ?, ?, ?, 'admin', TRUE)`,
      [ADMIN_EMAIL, hashedPassword, ADMIN_FIRST_NAME, ADMIN_LAST_NAME]
    );

    const userId = insertResult.insertId;
    console.log('✅ Admin user created with ID:', userId, '\n');

    // Get OSWSAdmin role ID
    const [roles] = await connection.query(
      'SELECT role_id FROM Roles WHERE role_name = ?',
      ['OSWSAdmin']
    );

    if (roles.length === 0) {
      throw new Error('OSWSAdmin role not found in database. Did you run the migration?');
    }

    const adminRoleId = roles[0].role_id;

    // Assign OSWSAdmin role
    console.log('🎭 Assigning OSWSAdmin role...');
    await connection.query(
      'INSERT INTO UserRoles (user_id, role_id) VALUES (?, ?)',
      [userId, adminRoleId]
    );
    console.log('✅ OSWSAdmin role assigned\n');

    // Commit transaction
    await connection.commit();
    console.log('✅ Transaction committed\n');

    // Display credentials
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Admin User Created Successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:   ', ADMIN_EMAIL);
    console.log('🔑 Password:', ADMIN_PASSWORD);
    console.log('👤 Name:    ', `${ADMIN_FIRST_NAME} ${ADMIN_LAST_NAME}`);
    console.log('🎭 Role:     OSWSAdmin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!\n');

  } catch (error) {
    if (connection) {
      await connection.rollback();
      console.log('❌ Transaction rolled back\n');
    }

    console.error('❌ Error creating admin user:');
    console.error(error.message);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('\n💡 Hint: Run the RBAC migration first:');
      console.error('   mysql -u root -p gcorganizedb < migrations/rbac_implementation.sql\n');
    }

    process.exit(1);

  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
createAdminUser()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });
