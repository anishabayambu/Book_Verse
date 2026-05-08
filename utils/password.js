const bcrypt = require('bcryptjs');

// Validate password strength
const validatePasswordStrength = (password) => {
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const hasMinLength = password.length >= 8;

  const score = 
    (hasUppercase ? 1 : 0) +
    (hasLowercase ? 1 : 0) +
    (hasNumber ? 1 : 0) +
    (hasSpecialChar ? 1 : 0) +
    (hasMinLength ? 1 : 0);

  let strength = 'Weak';
  if (score === 1 || score === 2) strength = 'Weak';
  else if (score === 3) strength = 'Medium';
  else if (score === 4) strength = 'Strong';
  else if (score === 5) strength = 'Very Strong';

  return {
    isValid: hasUppercase && hasLowercase && hasNumber && hasSpecialChar && hasMinLength,
    strength,
    score,
    requirements: {
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
      hasMinLength
    }
  };
};

// Hash password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = {
  validatePasswordStrength,
  hashPassword,
  comparePassword,
  generateOTP
};
