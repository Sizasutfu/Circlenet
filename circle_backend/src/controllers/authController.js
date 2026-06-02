const passwordService = require("../services/passwordService");
const emailVerificationService = require("../services/emailVerificationService");
const { sendOk, sendError } = require("../middleware/response");
const parseUserAgent = require("../utils/userAgentParser");

async function requestPasswordReset(req, res) {
  const { email } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const requestTimestamp = new Date();
  const userAgent = req.headers['user-agent'];
  const deviceInfo = parseUserAgent(userAgent); // now returns rich object

  if (!email) {
    return sendError(res, 400, "Email is required.");
  }

  // Optional: normalize email
  const normalizedEmail = email.trim().toLowerCase();

  try {
    await passwordService.initiatePasswordReset(normalizedEmail, {
      ip,
      requestTimestamp,
      deviceInfo,  // passes the full object including brand/model
      logger: req.log || console,
    });
    return sendOk(res, 200, "A reset link has been sent.");
  } catch (e) {
    console.error("[requestPasswordReset]", e);
    // Don't leak internal errors to the client
    return sendError(res, 500, "Failed to send reset email. Please try again.");
  }
}

async function confirmResetPassword(req, res) {
  const { token, password } = req.body;

  if (!token || !password) {
    return sendError(res, 400, "Token and password are required.");
  }

  if (password.length < 6) {
    return sendError(res, 400, "Password must be at least 6 characters.");
  }

  try {
    await passwordService.confirmPasswordReset(token, password);
    return sendOk(res, 200, "Password updated successfully.");
  } catch (e) {
    console.error("[confirmResetPassword]", e);
    const statusCode = e.statusCode || 500;
    const message = e.statusCode ? e.message : "Server error.";
    return sendError(res, statusCode, message);
  }
}

async function sendVerification(req, res) {
  const { email } = req.body;

  if (!email) {
    return sendError(res, 400, "Email is required.");
  }

  try {
    await emailVerificationService.sendVerificationToUser(email);
    return sendOk(res, 200, "Verification code sent.");
  } catch (e) {
    console.error("[sendVerification]", e);
    return sendError(res, 500, "Failed to send verification email. Please try again.");
  }
}

async function verifyEmail(req, res) {
  const { email, code } = req.body;

  if (!email || !code) {
    return sendError(res, 400, "Email and code are required.");
  }

  try {
    await emailVerificationService.verifyEmailCode(email, code);
    return sendOk(res, 200, "Email verified successfully.");
  } catch (e) {
    console.error("[verifyEmail]", e);
    const statusCode = e.statusCode || 500;
    const message = e.statusCode ? e.message : "Server error.";
    return sendError(res, statusCode, message);
  }
}

module.exports = { requestPasswordReset, confirmResetPassword, sendVerification, verifyEmail };