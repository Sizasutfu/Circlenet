// services/passwordService.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const UserModel = require('../models/userModel');
const { sendPasswordResetEmail } = require('./emailService');

// ---------- Configuration ----------
const SALT_ROUNDS = 10;
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_EXPIRY_HOURS = 1;

// ---------- Token Management ----------

/**
 * Generates a cryptographically secure reset token.
 * @returns {string} A 64-character hexadecimal token
 */
function generateResetToken() {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
}

/**
 * Calculates token expiry timestamp.
 * @param {number} hours - Hours until expiry (default: 1)
 * @returns {Date} Expiry date
 */
function getTokenExpiry(hours = RESET_TOKEN_EXPIRY_HOURS) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// ---------- Public API ----------

/**
 * Validates password strength.
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and message
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }

  if (password.length > 128) {
    return { isValid: false, message: 'Password must not exceed 128 characters' };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const strength = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;

  if (strength < 2) {
    return {
      isValid: false,
      message: 'Password must contain at least 2 of: uppercase letters, lowercase letters, numbers, special characters',
    };
  }

  return { isValid: true, message: 'Password meets requirements' };
}

/**
 * Initiates password reset for an email address.
 * Returns true if user exists (silent otherwise to prevent email enumeration),
 * and sends email with reset instructions.
 *
 * @param {string} email - User's email address
 * @returns {Promise<boolean>} True if user exists and email was sent
 */
async function initiatePasswordReset(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return false;
  }

  const user = await UserModel.findByEmail(email.trim().toLowerCase());
  if (!user) return false; // Silent to avoid email enumeration

  const token = generateResetToken();
  const expires = getTokenExpiry();

  await UserModel.saveResetToken(user.id, token, expires);
  await sendPasswordResetEmail({
    to: email,
    name: user.name,
    token,
  });

  return true;
}

/**
 * Confirms password reset using token and new password.
 * Validates token, checks password strength, updates password,
 * and clears the reset token.
 *
 * @param {string} token - Reset token from email
 * @param {string} newPassword - New password
 * @throws {Error} If token invalid/expired or password invalid
 */
async function confirmPasswordReset(token, newPassword) {
  if (!token || typeof token !== 'string') {
    const error = new Error('Invalid reset token.');
    error.statusCode = 400;
    throw error;
  }

  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.isValid) {
    const error = new Error(passwordValidation.message);
    error.statusCode = 400;
    throw error;
  }

  const user = await UserModel.findByValidResetToken(token);
  if (!user) {
    const error = new Error('Reset link is invalid or has expired. Please request a new one.');
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await UserModel.updatePasswordAndClearToken(user.id, hashedPassword);
}

module.exports = {
  initiatePasswordReset,
  confirmPasswordReset,
  validatePasswordStrength,
  generateResetToken,
  getTokenExpiry,
};