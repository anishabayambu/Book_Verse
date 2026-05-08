const pool = require('../config/database');
const { hashPassword } = require('../utils/password');
require('dotenv').config();

async function createAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@bookverse.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';

  try {
    const connection = await pool.getConnection();

    // Check if admin already exists
    const [existingAdmin] = await connection.query(
      'SELECT id FROM users WHERE email = ? AND role = "admin"',
      [adminEmail]
    );

    if (existingAdmin.length > 0) {
      console.log('Admin user already exists.');
      connection.release();
      process.exit(0);
    }

    // Hash password and set expiry date (90 days from now)
    const hashedPassword = await hashPassword(adminPassword);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);

    // Insert admin user
    const [result] = await connection.query(
      'INSERT INTO users (username, email, password, password_expiry_date, role) VALUES (?, ?, ?, ?, ?)',
      [adminUsername, adminEmail, hashedPassword, expiryDate, 'admin']
    );

    // Store password in history
    await connection.query(
      'INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)',
      [result.insertId, hashedPassword]
    );

    connection.release();

    console.log('Admin user created successfully!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('Please change the password after first login.');

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

createAdmin();
