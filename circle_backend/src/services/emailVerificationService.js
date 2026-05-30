// services/emailVerificationService.js
const crypto = require('crypto');
const UserModel = require('../models/userModel');
const { sendVerificationEmail } = require('./emailService');

const CODE_EXPIRY_MINUTES = 15;

/**
 * Generates a cryptographically secure 6-digit verification code.
 * @returns {string} A 6-digit numeric string
 */
function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Calculates code expiry timestamp.
 * @param {number} minutes - Minutes until expiry
 * @returns {Date} Expiry date
 */
function expiresAt(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Finds the user by email, generates a verification code,
 * saves it to the DB, and sends the verification email.
 *
 * @param {string} email - User's email address
 * @returns {Promise<boolean>} True if user found and email sent, false otherwise
 */
async function sendVerificationToUser(email) {
  const user = await UserModel.findByEmail(email);
  if (!user) return false;

  const code = generateCode();
  const expires = expiresAt(CODE_EXPIRY_MINUTES);

  await UserModel.saveVerificationCode(user.id, code, expires);
  await sendVerificationEmail({ to: email, name: user.name, code });

  return true;
}

/**
 * Verifies the code for a given email.
 * Marks the user's email as verified if the code is valid and not expired.
 *
 * @param {string} email - User's email address
 * @param {string} code - Verification code submitted by the user
 * @throws {Error} If code is invalid or expired
 */
async function verifyEmailCode(email, code) {
  const user = await UserModel.findByValidVerificationCode(email, code);
  if (!user) {
    const error = new Error('Invalid or expired verification code.');
    error.statusCode = 400;
    throw error;
  }

  await UserModel.markEmailVerified(user.id);
}

/**
 * Generates a plain code without sending it — useful for testing.
 * @returns {string} A 6-digit numeric string
 */
function generatePlainCode() {
  return generateCode();
}

module.exports = {
  sendVerificationToUser,
  verifyEmailCode,
  generatePlainCode,
};