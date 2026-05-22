const UserModel = require("../models/userModel");
const { sendVerificationEmail } = require("./emailService");

const CODE_EXPIRY_MINUTES = 15;

/** Generates a random 6-digit string, zero-padded */
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Returns a Date object N minutes from now */
function expiresAt(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function sendVerification(email) {
  const user = await UserModel.findByEmail(email);
  if (!user) return; // Don't reveal whether the email exists

  const code = generateCode();
  const expires = expiresAt(CODE_EXPIRY_MINUTES);

  await UserModel.saveVerificationCode(user.id, code, expires);

  await sendVerificationEmail({
    to: email,
    name: user.name,
    code,
  });
}

async function verifyCode(email, code) {
  const user = await UserModel.findByValidVerificationCode(email, code);

  if (!user) {
    const error = new Error("Invalid or expired code.");
    error.statusCode = 400;
    throw error;
  }

  await UserModel.markEmailVerified(user.id);
}

module.exports = { sendVerification, verifyCode };
