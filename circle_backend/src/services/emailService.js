const { sendEmail } = require('../config/mailer');

// Branding & links – set these in your .env
const FROM = process.env.NODE_ENV === 'production'
  ? '"CircleNet" <noreply@circlenet.social>'
  : `"CircleNet" <${process.env.EMAIL_USER}>`;
const LOGO_URL = process.env.CIRCLE_LOGO_URL || 'https://circlenet.social/logo.png'; // Replace with actual logo URL
const COMPANY_URL = process.env.COMPANY_URL || 'https://circlenet.social';
const PRIVACY_URL = process.env.PRIVACY_POLICY_URL || 'https://circlenet.social/privacy';
const TERMS_URL = process.env.TERMS_URL || 'https://circlenet.social/terms';

function formatDateTime(date) {
  if (!date) return 'Not available';
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

// Build email HTML with full responsiveness, dark mode support, and accessibility
function buildPasswordResetHtml({ name, resetUrl, ip, requestTime, expiryTime }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Reset your CircleNet password</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .card { padding: 20px !important; }
      .button { display: block !important; width: 100% !important; text-align: center; }
      .fallback-link { word-break: break-all; }
    }
    @media (prefers-color-scheme: dark) {
      body { background-color: #1a1a1a !important; }
      .card-bg { background-color: #2d2d2d !important; color: #e0e0e0 !important; }
      .footer, .footer a { color: #aaa !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#f5f7fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;">
    <!-- Main container (table for Outlook compatibility) -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; border-radius: 24px; box-shadow: 0 8px 20px rgba(0,0,0,0.05);">
      <tr>
        <td style="padding: 32px 30px 20px 30px;" align="center">
          <!-- Logo with alt text -->
          <img src="${LOGO_URL}" alt="CircleNet logo" width="140" style="max-width:100%; height:auto; border:0;" />
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 30px 30px 30px;">
          <h1 style="color:#2c3e4f; font-size:24px; margin:0 0 12px 0; font-weight:600;">Reset your password</h1>
          <p style="color:#4a5b6e; font-size:16px; line-height:1.5; margin:0 0 20px 0;">Hi <strong>${escapeHtml(name)}</strong>,</p>
          <p style="color:#4a5b6e; font-size:16px; line-height:1.5; margin:0 0 24px 0;">
            We received a request to reset the password for your CircleNet account. You can reset it using the button below.
            This link will expire in <strong style="color:#7c6bff;">1 hour</strong>.
          </p>

          <!-- Security metadata -->
          <div style="background:#f8f9fc; border-left: 4px solid #7c6bff; padding: 14px 18px; margin: 20px 0 24px 0; border-radius: 8px;">
            <p style="margin:0 0 6px 0; font-size:14px; color:#3b4b5e;"><strong>🔐 Security information</strong></p>
            <p style="margin:4px 0; font-size:13px; color:#5d6f82;">Requested on: ${formatDateTime(requestTime)}</p>
            <p style="margin:4px 0; font-size:13px; color:#5d6f82;">IP address: ${ip || 'Not available'}</p>
            <p style="margin:8px 0 0 0; font-size:13px; color:#5d6f82;">Expires at: ${formatDateTime(expiryTime)}</p>
            <p style="margin:12px 0 0 0; font-size:13px; color:#7c6bff;">⚠️ If you didn't request this, you can safely ignore this email. No changes have been made to your account.</p>
          </div>

          <!-- Primary reset button -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 20px;">
            <tr>
              <td align="center">
                <a href="${resetUrl}" class="button" style="display: inline-block; background:#7c6bff; color:#ffffff; font-weight:600; text-decoration:none; padding: 14px 32px; border-radius: 40px; font-size:16px; letter-spacing:0.5px; box-shadow: 0 2px 6px rgba(124,107,255,0.3);">Reset your password</a>
              </td>
            </tr>
          </table>

          <!-- Fallback link -->
          <div style="margin-top: 24px; padding: 16px 0 8px; border-top: 1px solid #e9edf2;">
            <p style="font-size:13px; color:#7e8c9e; margin:0 0 8px 0;">If the button doesn't work, copy and paste the following link into your browser:</p>
            <p class="fallback-link" style="font-size:13px; background:#f5f7fc; padding:10px 12px; border-radius:8px; word-break:break-all; margin:0; font-family: monospace;">${escapeHtml(resetUrl)}</p>
          </div>

          <!-- Professional footer -->
          <div class="footer" style="margin-top: 42px; padding-top: 20px; border-top: 1px solid #e9edf2; font-size:12px; color:#8a99aa; text-align:center;">
            <p style="margin:0 0 6px 0;">© 2026 CircleNet. All rights reserved.</p>
            <p style="margin:0 0 8px 0;">This is an automated email. Please do not reply.</p>
            <p style="margin:0;">
              <a href="${COMPANY_URL}" style="color:#7c6bff; text-decoration:none;">CircleNet</a> &nbsp;|&nbsp;
              <a href="${PRIVACY_URL}" style="color:#7c6bff; text-decoration:none;">Privacy Policy</a> &nbsp;|&nbsp;
              <a href="${TERMS_URL}" style="color:#7c6bff; text-decoration:none;">Terms of Service</a>
            </p>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

// Helper to prevent XSS in name / URL
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

async function sendPasswordResetEmail({ to, name, token, ip, requestTimestamp }) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const requestTime = requestTimestamp || new Date();
  const expiryTime = new Date(requestTime.getTime() + 60 * 60 * 1000); // exactly 1 hour

  const html = buildPasswordResetHtml({
    name,
    resetUrl,
    ip: ip || 'unavailable',
    requestTime,
    expiryTime
  });

  await sendEmail({
    from: FROM,
    to,
    subject: 'Reset your CircleNet password',
    html,
  });
}

// Also improve verification email with consistent branding & footer
async function sendVerificationEmail({ to, name, code }) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your CircleNet email</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width:100% !important; }
      .card { padding:20px !important; }
    }
  </style>
</head>
<body style="margin:0; background:#f5f7fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 520px; margin:30px auto; background:#fff; border-radius:28px; box-shadow:0 8px 18px rgba(0,0,0,0.05); overflow:hidden;">
    <div style="padding:30px 28px 20px; text-align:center; border-bottom:1px solid #f0f2f5;">
      <img src="${LOGO_URL}" alt="CircleNet" width="130" style="max-width:100%;">
    </div>
    <div style="padding:28px 30px 38px;">
      <h2 style="color:#2c3e4f; margin:0 0 12px;">Verify your email</h2>
      <p style="color:#4a5b6e; font-size:16px; line-height:1.5;">Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p style="color:#4a5b6e; margin:0 0 20px;">Thanks for joining CircleNet! Use this code to verify your address. It expires in <strong>15 minutes</strong>.</p>
      <div style="background:#f3f0ff; border-radius:18px; padding:18px; text-align:center; margin:28px 0;">
        <span style="font-size:34px; font-weight:700; letter-spacing:8px; color:#7c6bff;">${code}</span>
      </div>
      <p style="color:#7e8c9e; font-size:13px;">If you didn't create an account, please ignore this email.</p>
      <div class="footer" style="margin-top:40px; padding-top:18px; border-top:1px solid #eef2f8; text-align:center; font-size:12px; color:#8a99aa;">
        <p style="margin:0 0 6px;">© 2026 CircleNet. All rights reserved.</p>
        <p><a href="${COMPANY_URL}" style="color:#7c6bff; text-decoration:none;">CircleNet</a> &nbsp;|&nbsp; <a href="${PRIVACY_URL}" style="color:#7c6bff;">Privacy</a> &nbsp;|&nbsp; <a href="${TERMS_URL}" style="color:#7c6bff;">Terms</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;

  await sendEmail({
    from: FROM,
    to,
    subject: 'Verify your CircleNet email',
    html,
  });
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail };