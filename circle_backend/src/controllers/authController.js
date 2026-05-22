const passwordService = require("../services/passwordService");
const emailVerificationService = require("../services/emailVerificationService");
const { sendOk, sendError } = require("../middleware/response");

async function requestPasswordReset(req, res) {
  const { email } = req.body;

  if (!email) {
    return sendError(res, 400, "Email is required.");
  }

  try {
    await passwordService.initiatePasswordReset(email);
    return sendOk(res, 200, "A reset link has been sent.");
  } catch (e) {
    console.error("[requestPasswordReset]", e);
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

// ─── POST /api/auth/email/send-verification ────────────────────────────────────

async function sendVerification(req, res) {
  const { email } = req.body;

  if (!email) {
    return sendError(res, 400, "Email is required.");
  }

  try {
    await emailVerificationService.sendVerification(email);
    // Always return 200 — don't reveal whether the email exists
    return sendOk(res, 200, "Verification code sent.");
  } catch (e) {
    console.error("[sendVerification]", e);
    return sendError(res, 500, "Failed to send verification email. Please try again.");
  }
}

// ─── POST /api/auth/email/verify ──────────────────────────────────────────────

async function verifyEmail(req, res) {
  const { email, code } = req.body;

  if (!email || !code) {
    return sendError(res, 400, "Email and code are required.");
  }

  try {
    await emailVerificationService.verifyCode(email, code);
    return sendOk(res, 200, "Email verified successfully.");
  } catch (e) {
    console.error("[verifyEmail]", e);
    const statusCode = e.statusCode || 500;
    const message = e.statusCode ? e.message : "Server error.";
    return sendError(res, statusCode, message);
  }
}

module.exports = { requestPasswordReset, confirmResetPassword, sendVerification, verifyEmail };