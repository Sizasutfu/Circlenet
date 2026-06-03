const bcrypt = require('bcrypt');
const crypto = require('crypto');
const UserModel = require('../models/userModel');
const { sendPasswordResetEmail } = require('./emailService');
const parseUserAgent = require('../utils/userAgentParser');
const formatDeviceString = require('../utils/deviceFormatter');

// ---------- Configuration ----------
const SALT_ROUNDS = 10;
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_EXPIRY_HOURS = 1;

// ---------- Token Management ----------
function generateResetToken() {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
}

function getTokenExpiry(hours = RESET_TOKEN_EXPIRY_HOURS) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// ---------- Password Validation ----------
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
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const strength = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
  if (strength < 2) {
    return {
      isValid: false,
      message: 'Password must contain at least 2 of: uppercase, lowercase, numbers, special characters',
    };
  }
  return { isValid: true, message: 'Password meets requirements' };
}

// ---------- Public API ----------

/**
 * Initiates password reset.
 * @param {string} email - User's email
 * @param {Object} options - Metadata
 * @param {string} [options.ip] - IP address
 * @param {Date} [options.requestTimestamp] - Request time
 * @param {string|Object} [options.deviceInfo] - Can be a string (preferred) or a raw user-agent string / parsed object
 * @param {Object} [options.logger] - Logger
 * @returns {Promise<boolean>} True if user exists and email sent
 */
async function initiatePasswordReset(email, options = {}) {
  const { ip, requestTimestamp = new Date(), deviceInfo, logger = console } = options;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return false;
  }

  const user = await UserModel.findByEmail(email.trim().toLowerCase());
  if (!user) return false;

  // 🔥 FIX: Convert deviceInfo to a readable string if it's an object or user-agent string
  let deviceString = 'Unknown device';
  if (deviceInfo) {
    if (typeof deviceInfo === 'string') {
      // It might be a raw user-agent string – try to parse it for better readability
      const parsed = parseUserAgent(deviceInfo);
      deviceString = parsed ? formatDeviceString(parsed) : deviceInfo.substring(0, 100);
    } else if (typeof deviceInfo === 'object') {
      // Assume it's already parsed from parseUserAgent()
      deviceString = formatDeviceString(deviceInfo);
    } else {
      deviceString = String(deviceInfo);
    }
  }

  const token = generateResetToken();
  const expires = getTokenExpiry();
  await UserModel.saveResetToken(user.id, token, expires);

  const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;

  await sendPasswordResetEmail({
    to: email,
    name: user.name,
    resetUrl,
    ip: ip || 'unavailable',
    requestTimestamp,
    expiryTime: expires,
    deviceInfo: deviceString,   // ✅ Now always a readable string
  });

  logger.info(`[AUDIT] Password reset for user ${user.id} (${email}) from IP ${ip || 'unknown'} - ${deviceString}`);
  return true;
}

/**
 * Confirms password reset with token and new password.
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