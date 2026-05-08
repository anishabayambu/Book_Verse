const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Send OTP email
const sendOtpEmail = async (email, otp) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your BookVerse Login OTP',
      html: `
        <h2>Login Verification</h2>
        <p>Your one-time password (OTP) for BookVerse login is:</p>
        <h1 style="color: #007bff; font-family: monospace; letter-spacing: 5px;">${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return { success: false, error: error.message };
  }
};

// Send password change notification
const sendPasswordChangeEmail = async (email, username) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Changed - BookVerse',
      html: `
        <h2>Password Changed Successfully</h2>
        <p>Hello ${username},</p>
        <p>Your password has been changed successfully.</p>
        <p>If you didn't make this change, please contact support immediately.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error sending password change email:', error);
    return { success: false, error: error.message };
  }
  // Update the sendOtpEmail function to handle different types
const sendOtpEmail = async (email, otp, type = 'login') => {
  let subject, text, html;
  
  if (type === 'password_reset') {
    subject = 'Password Reset OTP - BookVerse';
    text = `Your OTP for password reset is: ${otp}. This OTP is valid for 10 minutes.`;
    html = `
      <h2>Password Reset Request</h2>
      <p>You requested to reset your password for BookVerse account.</p>
      <p>Your OTP for password reset is: <strong style="font-size: 20px;">${otp}</strong></p>
      <p>This OTP is valid for 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
  } else {
    subject = 'Login OTP - BookVerse';
    text = `Your OTP for login is: ${otp}. This OTP is valid for 10 minutes.`;
    html = `
      <h2>Login Verification</h2>
      <p>Your OTP for BookVerse login is: <strong style="font-size: 20px;">${otp}</strong></p>
      <p>This OTP is valid for 10 minutes.</p>
    `;
  }
  
  // Your email sending logic here
  // ... (use nodemailer or your email service)
};
};


module.exports = {
  sendOtpEmail,
  sendPasswordChangeEmail
};
