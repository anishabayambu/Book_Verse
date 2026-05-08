const pool = require('../config/database');
const { hashPassword, comparePassword, generateOTP, validatePasswordStrength } = require('../utils/password');
const { sendOtpEmail } = require('../utils/email');
const axios = require('axios');
require('dotenv').config();

// Get registration page
const getRegister = (req, res) => {
  res.render('auth/register', { 
    title: 'Register - BookVerse',
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY 
  });
};

// Register user
const postRegister = async (req, res) => {
  try {
    const { username, email, password, confirmPassword, role, recaptchaToken } = req.body;

    // Validate reCAPTCHA
    if (!recaptchaToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please complete the reCAPTCHA verification.' 
      });
    }

    try {
      const recaptchaResponse = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify`,
        null,
        {
          params: {
            secret: process.env.RECAPTCHA_SECRET_KEY,
            response: recaptchaToken
          }
        }
      );

      if (!recaptchaResponse.data.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'reCAPTCHA verification failed.' 
        });
      }
    } catch (error) {
      console.error('reCAPTCHA error:', error);
      return res.status(400).json({ 
        success: false, 
        message: 'reCAPTCHA verification error.' 
      });
    }

    // Validate inputs
    if (!username || !email || !password || !confirmPassword || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required.' 
      });
    }

    // Validate role
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid account type selected.' 
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Passwords do not match.' 
      });
    }

    // Check password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password does not meet requirements.',
        requirements: passwordValidation.requirements
      });
    }

    // Check if user exists
    const connection = await pool.getConnection();
    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUsers.length > 0) {
      connection.release();
      return res.status(400).json({ 
        success: false, 
        message: 'Email or username already registered.' 
      });
    }

    // Hash password and set expiry date (90 days from now)
    const hashedPassword = await hashPassword(password);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);

    // Insert user
    const [result] = await connection.query(
      'INSERT INTO users (username, email, password, role, password_expiry_date) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, role, expiryDate]
    );

    // Store password in history
    await connection.query(
      'INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)',
      [result.insertId, hashedPassword]
    );

    connection.release();

    return res.status(200).json({ 
      success: true, 
      message: 'Registration successful. Please login.' 
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Registration failed. Please try again.' 
    });
  }
};

// Get login page
const getLogin = (req, res) => {
  res.render('auth/login', { title: 'Login - BookVerse' });
};

// Login user
const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required.' 
      });
    }

    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT id, username, email, password, role, password_expiry_date FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      connection.release();
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    const user = users[0];
    const isPasswordCorrect = await comparePassword(password, user.password);

    if (!isPasswordCorrect) {
      connection.release();
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    // Check if password has expired
    if (user.password_expiry_date && new Date(user.password_expiry_date) < new Date()) {
      connection.release();
      req.session.userIdForPasswordChange = user.id;
      return res.status(400).json({ 
        success: false, 
        message: 'Your password has expired. Please change it.',
        redirectTo: '/change-password'
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database with type 'login'
    await connection.query(
      'INSERT INTO otps (user_id, otp_code, expires_at, type) VALUES (?, ?, ?, ?)',
      [user.id, otp, otpExpiry, 'login']
    );

    // Send OTP email
    await sendOtpEmail(email, otp);

    // Store user info temporarily in session for OTP verification
    req.session.tempUserId = user.id;
    req.session.tempUserEmail = email;
    req.session.tempUsername = user.username;
    req.session.tempUserRole = user.role;

    connection.release();

    return res.status(200).json({ 
      success: true, 
      message: 'OTP sent to your email.' 
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Login failed. Please try again.' 
    });
  }
};

// Get OTP verification page
const getOtpVerification = (req, res) => {
  if (!req.session.tempUserId) {
    return res.redirect('/login');
  }
  res.render('auth/otp-verification', { 
    title: 'Verify OTP - BookVerse',
    email: req.session.tempUserEmail
  });
};

// Verify OTP
const postOtpVerification = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.tempUserId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Please login first.' 
      });
    }

    if (!otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP is required.' 
      });
    }

    const connection = await pool.getConnection();
    const [otpRecords] = await connection.query(
      'SELECT id, is_used FROM otps WHERE user_id = ? AND otp_code = ? AND expires_at > NOW() AND type = ? ORDER BY created_at DESC LIMIT 1',
      [req.session.tempUserId, otp, 'login']
    );

    if (otpRecords.length === 0) {
      connection.release();
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired OTP.' 
      });
    }

    // Mark OTP as used
    await connection.query(
      'UPDATE otps SET is_used = TRUE WHERE id = ?',
      [otpRecords[0].id]
    );

    // Set session
    req.session.userId = req.session.tempUserId;
    req.session.username = req.session.tempUsername;
    req.session.email = req.session.tempUserEmail;
    req.session.role = req.session.tempUserRole;

    // Clear temporary session variables
    delete req.session.tempUserId;
    delete req.session.tempUserEmail;
    delete req.session.tempUsername;
    delete req.session.tempUserRole;

    connection.release();

    return res.status(200).json({ 
      success: true, 
      message: 'Login successful.',
      redirectTo: req.session.role === 'admin' ? '/admin/dashboard' : '/user/dashboard'
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'OTP verification failed.' 
    });
  }
};

// Logout
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed.' });
    }
    res.redirect('/');
  });
};

// Get forgot password page (NO reCAPTCHA)
const getForgotPassword = (req, res) => {
  res.render('auth/forgot-password', { 
    title: 'Forgot Password - BookVerse'
  });
};

// Send OTP for password reset (NO reCAPTCHA validation)
const postForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required.' 
      });
    }

    const connection = await pool.getConnection();
    
    // Check if user exists
    const [users] = await connection.query(
      'SELECT id, email FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: 'No account found with this email address.' 
      });
    }

    const user = users[0];
    
    // Generate OTP for password reset
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database with type 'password_reset'
    await connection.query(
      'INSERT INTO otps (user_id, otp_code, expires_at, is_used, type) VALUES (?, ?, ?, ?, ?)',
      [user.id, otp, otpExpiry, false, 'password_reset']
    );

    // Send OTP email
    await sendOtpEmail(email, otp, 'password_reset');

    // Store user info in session for password reset
    req.session.resetUserId = user.id;
    req.session.resetUserEmail = email;

    connection.release();

    return res.status(200).json({ 
      success: true, 
      message: 'OTP sent to your email for password reset.' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to process request. Please try again.' 
    });
  }
};

// Get reset password page
const getResetPassword = (req, res) => {
  if (!req.session.resetUserId) {
    return res.redirect('/forgot-password');
  }
  res.render('auth/reset-password', { 
    title: 'Reset Password - BookVerse',
    email: req.session.resetUserEmail
  });
};

// Reset password with OTP
const postResetPassword = async (req, res) => {
  try {
    const { otp, newPassword, confirmPassword } = req.body;

    if (!req.session.resetUserId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Session expired. Please request password reset again.' 
      });
    }

    if (!otp || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required.' 
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Passwords do not match.' 
      });
    }

    // Check password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password does not meet requirements.',
        requirements: passwordValidation.requirements
      });
    }

    const connection = await pool.getConnection();
    
    // Verify OTP
    const [otpRecords] = await connection.query(
      `SELECT id FROM otps 
       WHERE user_id = ? AND otp_code = ? AND expires_at > NOW() 
       AND is_used = FALSE AND type = 'password_reset'
       ORDER BY created_at DESC LIMIT 1`,
      [req.session.resetUserId, otp]
    );

    if (otpRecords.length === 0) {
      connection.release();
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired OTP.' 
      });
    }

    // Check if new password is different from old password
    const [users] = await connection.query(
      'SELECT password FROM users WHERE id = ?',
      [req.session.resetUserId]
    );

    if (users.length === 0) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }

    const isSamePassword = await comparePassword(newPassword, users[0].password);
    if (isSamePassword) {
      connection.release();
      return res.status(400).json({ 
        success: false, 
        message: 'New password cannot be the same as the old password.' 
      });
    }

    // Check password history (prevent reuse of last 5 passwords)
    const [passwordHistory] = await connection.query(
      'SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [req.session.resetUserId]
    );

    for (const oldPassword of passwordHistory) {
      const isReused = await comparePassword(newPassword, oldPassword.password_hash);
      if (isReused) {
        connection.release();
        return res.status(400).json({ 
          success: false, 
          message: 'You cannot reuse one of your last 5 passwords.' 
        });
      }
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90); // 90 days expiry

    // Update user's password
    await connection.query(
      'UPDATE users SET password = ?, password_expiry_date = ? WHERE id = ?',
      [hashedPassword, expiryDate, req.session.resetUserId]
    );

    // Store in password history
    await connection.query(
      'INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)',
      [req.session.resetUserId, hashedPassword]
    );

    // Mark OTP as used
    await connection.query(
      'UPDATE otps SET is_used = TRUE WHERE id = ?',
      [otpRecords[0].id]
    );

    // Clear reset session
    delete req.session.resetUserId;
    delete req.session.resetUserEmail;

    connection.release();

    return res.status(200).json({ 
      success: true, 
      message: 'Password reset successful. You can now login with your new password.' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Password reset failed. Please try again.' 
    });
  }
};

// Resend OTP for password reset
const postResendResetOtp = async (req, res) => {
  try {
    if (!req.session.resetUserId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Session expired. Please request password reset again.' 
      });
    }

    const connection = await pool.getConnection();
    
    // Get user email
    const [users] = await connection.query(
      'SELECT email FROM users WHERE id = ?',
      [req.session.resetUserId]
    );

    if (users.length === 0) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Store new OTP
    await connection.query(
      'INSERT INTO otps (user_id, otp_code, expires_at, is_used, type) VALUES (?, ?, ?, ?, ?)',
      [req.session.resetUserId, otp, otpExpiry, false, 'password_reset']
    );

    // Send OTP email
    await sendOtpEmail(users[0].email, otp, 'password_reset');

    connection.release();

    return res.status(200).json({ 
      success: true, 
      message: 'New OTP sent to your email.' 
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to resend OTP. Please try again.' 
    });
  }
};

// Export all functions
module.exports = {
  getRegister,
  postRegister,
  getLogin,
  postLogin,
  getOtpVerification,
  postOtpVerification,
  logout,
  getForgotPassword,
  postForgotPassword,
  getResetPassword,
  postResetPassword,
  postResendResetOtp
};