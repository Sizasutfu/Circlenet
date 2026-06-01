const { sendEmail } = require('../config/mailer');

const FROM = process.env.NODE_ENV === 'production'
  ? '"CircleNet" <noreply@circlenet.social>'
  : `"CircleNet" <${process.env.EMAIL_USER}>`;
const LOGO_URL = process.env.CIRCLE_LOGO_URL || 'https://circlenet.social/logo.png';
const COMPANY_URL = process.env.COMPANY_URL || 'https://circlenet.social';
const PRIVACY_URL = process.env.PRIVACY_POLICY_URL || 'https://circlenet.social/privacy';
const TERMS_URL = process.env.TERMS_URL || 'https://circlenet.social/terms';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@circlenet.social';

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

function maskIp(ip) {
  if (!ip || ip === 'unavailable') return 'unavailable';
  if (ip.includes('.') && ip.split('.').length === 4) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.xxx.xxx`;
  }
  if (ip.includes(':')) {
    const groups = ip.split(':');
    const shown = groups.slice(0, 2).join(':');
    return `${shown}:xxxx:xxxx:xxxx:xxxx`;
  }
  return 'unavailable';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

/* ─────────────────────────────────────────────
   SHARED LAYOUT HELPERS
───────────────────────────────────────────── */

function sharedHead(title) {
  return `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');

    * { box-sizing: border-box; }

    @media only screen and (max-width: 600px) {
      .wrapper { padding: 16px !important; }
      .card    { border-radius: 16px !important; padding: 28px 20px !important; }
      .btn     { display: block !important; width: 100% !important; text-align: center !important; }
    }

    @media (prefers-color-scheme: dark) {
      .email-bg  { background-color: #0f0f12 !important; }
      .card      { background-color: #18181f !important; border-color: #2a2a38 !important; }
      .card-body { color: #cdd5e0 !important; }
      .heading   { color: #f0eeff !important; }
      .meta-box  { background-color: #1f1f2e !important; border-color: #35355a !important; }
      .meta-text { color: #a0a8c0 !important; }
      .divider   { border-color: #252535 !important; }
      .footer-text { color: #555570 !important; }
      .footer-link { color: #8878f8 !important; }
    }
  </style>`;
}

function sharedFooter() {
  return `
    <tr>
      <td class="footer-text" style="padding: 28px 0 0 0; text-align: center; font-family: 'DM Sans', Arial, sans-serif; font-size: 11px; color: #9099b0; line-height: 1.7;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="padding-bottom: 10px;">
              <a href="${COMPANY_URL}" style="font-family: 'DM Sans', Arial, sans-serif; text-decoration: none; margin: 0 10px; font-size: 11px; color: #6c6fff;" class="footer-link">CircleNet</a>
              <span style="color: #c0c8e0;">·</span>
              <a href="${PRIVACY_URL}" style="font-family: 'DM Sans', Arial, sans-serif; text-decoration: none; margin: 0 10px; font-size: 11px; color: #6c6fff;" class="footer-link">Privacy</a>
              <span style="color: #c0c8e0;">·</span>
              <a href="${TERMS_URL}" style="font-family: 'DM Sans', Arial, sans-serif; text-decoration: none; margin: 0 10px; font-size: 11px; color: #6c6fff;" class="footer-link">Terms</a>
              <span style="color: #c0c8e0;">·</span>
              <a href="mailto:${SUPPORT_EMAIL}" style="font-family: 'DM Sans', Arial, sans-serif; text-decoration: none; margin: 0 10px; font-size: 11px; color: #6c6fff;" class="footer-link">Support</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="color: #aab0c8;">
              © 2026 CircleNet. All rights reserved. · This is an automated message — please do not reply.
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/* ─────────────────────────────────────────────
   PASSWORD RESET EMAIL
───────────────────────────────────────────── */

function buildPasswordResetHtml({ name, resetUrl, ip, requestTime, expiryTime, deviceInfo }) {
  const maskedIp = maskIp(ip);

  return `<!DOCTYPE html>
<html lang="en">
<head>${sharedHead('Reset your CircleNet password')}</head>
<body class="email-bg" style="margin: 0; padding: 0; background: #f2f3f8;">

  <div class="wrapper" style="max-width: 580px; margin: 0 auto; padding: 40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">

      <!-- Logo row (small, top-left aligned) -->
      <tr>
        <td style="padding: 0 0 20px 4px;">
          <img src="${LOGO_URL}" alt="CircleNet" width="64" height="auto"
               style="display: block; border: 0; opacity: 0.85;" />
        </td>
      </tr>

      <!-- Card -->
      <tr>
        <td class="card" style="background: #ffffff; border: 1px solid #e4e6f0; border-radius: 20px; padding: 44px 40px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">

            <!-- Label chip -->
            <tr>
              <td style="padding-bottom: 18px;">
                <span style="display: inline-block; background: #eeecff; color: #5a4ef8; font-family: 'DM Sans', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; padding: 5px 12px; border-radius: 100px;">Password Reset</span>
              </td>
            </tr>

            <!-- Heading -->
            <tr>
              <td style="padding-bottom: 16px;">
                <h1 class="heading" style="margin: 0; font-family: 'DM Serif Display', Georgia, serif; font-size: 32px; font-weight: 400; color: #1a1a2e; line-height: 1.15;">
                  Forgot your<br>password?
                </h1>
              </td>
            </tr>

            <!-- Body copy -->
            <tr>
              <td class="card-body" style="padding-bottom: 32px; font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; line-height: 1.65; color: #4b5268;">
                <p style="margin: 0 0 12px 0;">Hi <strong style="color: #1a1a2e;">${escapeHtml(name)}</strong>,</p>
                <p style="margin: 0;">We received a request to reset your CircleNet password. Click the button below — this link is valid for <strong style="color: #5a4ef8;">1 hour</strong> only.</p>
              </td>
            </tr>

            <!-- CTA Button -->
            <tr>
              <td style="padding-bottom: 36px;" align="center">
                <a href="${escapeHtml(resetUrl)}" class="btn"
                   style="display: inline-block; background: #1a1a2e; color: #ffffff; font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; padding: 15px 38px; border-radius: 100px; letter-spacing: 0.3px;">
                  Reset Password →
                </a>
              </td>
            </tr>

            <!-- Thin divider -->
            <tr>
              <td class="divider" style="padding-bottom: 24px; border-top: 1px solid #e8eaf2;"></td>
            </tr>

            <!-- Security metadata -->
            <tr>
              <td style="padding-top: 0;">
                <table class="meta-box" width="100%" cellpadding="0" cellspacing="0" border="0"
                       style="background: #f8f8fc; border: 1px solid #eaebf5; border-radius: 12px; padding: 18px 20px;">
                  <tr>
                    <td>
                      <p style="margin: 0 0 10px 0; font-family: 'DM Sans', Arial, sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: #8590b0;" class="meta-text">Security Details</p>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding: 4px 0; font-family: 'DM Sans', Arial, sans-serif; font-size: 13px; color: #6b7494; width: 100px;" class="meta-text">Requested</td>
                          <td style="padding: 4px 0; font-family: 'DM Sans', Arial, sans-serif; font-size: 13px; color: #2c3050;" class="meta-text"><strong>${formatDateTime(requestTime)}</strong></td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; font-family: 'DM Sans', Arial, sans-serif; font-size: 13px; color: #6b7494;" class="meta-text">Expires</td>
                          <td style="padding: 4px 0; font-family: 'DM Sans', Arial, sans-serif; font-size: 13px; color: #2c3050;" class="meta-text"><strong>${formatDateTime(expiryTime)}</strong></td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; font-family: 'DM Sans', Arial, sans-serif; font-size: 13px; color: #6b7494;" class="meta-text">IP Address</td>
                          <td style="padding: 4px 0; font-family: 'DM Sans', Arial, sans-serif; font-size: 13px; color: #2c3050;" class="meta-text"><strong>${maskedIp}</strong></td>
                        </tr>
                        ${deviceInfo ? `
                        <tr>
                          <td style="padding: 4px 0; font-family: 'DM Sans', Arial, sans-serif; font-size: 13px; color: #6b7494;" class="meta-text">Device</td>
                          <td style="padding: 4px 0; font-family: 'DM Sans', Arial, sans-serif; font-size: 13px; color: #2c3050;" class="meta-text"><strong>${escapeHtml(deviceInfo)}</strong></td>
                        </tr>` : ''}
                      </table>
                      <p style="margin: 14px 0 0 0; font-family: 'DM Sans', Arial, sans-serif; font-size: 12.5px; color: #8895b8; line-height: 1.55;" class="meta-text">
                        Didn't request this? You can safely ignore this email — your account remains unchanged.
                        Need help? <a href="mailto:${SUPPORT_EMAIL}" style="color: #5a4ef8; text-decoration: none; font-weight: 500;">Contact support.</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Fallback link -->
            <tr>
              <td style="padding-top: 20px; font-family: 'DM Sans', Arial, sans-serif; font-size: 12px; color: #9099b0; line-height: 1.5;">
                Button not working? <a href="${escapeHtml(resetUrl)}" style="color: #5a4ef8; text-decoration: underline; text-underline-offset: 2px;">${COMPANY_URL}/reset-password</a>
              </td>
            </tr>

            ${sharedFooter()}

          </table>
        </td>
      </tr>

    </table>
  </div>

</body>
</html>`;
}

async function sendPasswordResetEmail({ to, name, token, ip, requestTimestamp, deviceInfo }) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const requestTime = requestTimestamp || new Date();
  const expiryTime = new Date(requestTime.getTime() + 60 * 60 * 1000);

  const html = buildPasswordResetHtml({
    name,
    resetUrl,
    ip: ip || 'unavailable',
    requestTime,
    expiryTime,
    deviceInfo: deviceInfo || null,
  });

  await sendEmail({
    from: FROM,
    to,
    subject: 'Reset your CircleNet password',
    html,
  });
}

/* ─────────────────────────────────────────────
   VERIFICATION EMAIL
───────────────────────────────────────────── */

async function sendVerificationEmail({ to, name, code }) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>${sharedHead('Verify your CircleNet email')}</head>
<body class="email-bg" style="margin: 0; padding: 0; background: #f2f3f8;">

  <div class="wrapper" style="max-width: 520px; margin: 0 auto; padding: 40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">

      <!-- Logo row (small) -->
      <tr>
        <td style="padding: 0 0 20px 4px;">
          <img src="${LOGO_URL}" alt="CircleNet" width="64" height="auto"
               style="display: block; border: 0; opacity: 0.85;" />
        </td>
      </tr>

      <!-- Card -->
      <tr>
        <td class="card" style="background: #ffffff; border: 1px solid #e4e6f0; border-radius: 20px; padding: 44px 40px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">

            <!-- Label chip -->
            <tr>
              <td style="padding-bottom: 18px;">
                <span style="display: inline-block; background: #edfaf3; color: #1f9e62; font-family: 'DM Sans', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; padding: 5px 12px; border-radius: 100px;">Email Verification</span>
              </td>
            </tr>

            <!-- Heading -->
            <tr>
              <td style="padding-bottom: 16px;">
                <h1 class="heading" style="margin: 0; font-family: 'DM Serif Display', Georgia, serif; font-size: 32px; font-weight: 400; color: #1a1a2e; line-height: 1.15;">
                  Confirm your<br>email address.
                </h1>
              </td>
            </tr>

            <!-- Body copy -->
            <tr>
              <td class="card-body" style="padding-bottom: 32px; font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; line-height: 1.65; color: #4b5268;">
                <p style="margin: 0 0 12px 0;">Welcome, <strong style="color: #1a1a2e;">${escapeHtml(name)}</strong>.</p>
                <p style="margin: 0;">Enter this code to verify your email and activate your CircleNet account. It expires in <strong style="color: #1f9e62;">15 minutes</strong>.</p>
              </td>
            </tr>

            <!-- Code block -->
            <tr>
              <td style="padding-bottom: 36px;" align="center">
                <div style="display: inline-block; background: #f7f6ff; border: 2px solid #e2deff; border-radius: 16px; padding: 22px 40px; text-align: center;">
                  <span style="font-family: 'DM Sans', 'Courier New', monospace; font-size: 40px; font-weight: 700; letter-spacing: 10px; color: #1a1a2e; display: block; line-height: 1;">${code}</span>
                  <span style="font-family: 'DM Sans', Arial, sans-serif; font-size: 11px; color: #9099b0; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; display: block;">one-time code</span>
                </div>
              </td>
            </tr>

            <!-- Thin divider -->
            <tr>
              <td class="divider" style="padding-bottom: 20px; border-top: 1px solid #e8eaf2;"></td>
            </tr>

            <!-- Small disclaimer -->
            <tr>
              <td style="font-family: 'DM Sans', Arial, sans-serif; font-size: 13px; color: #9099b0; line-height: 1.55;">
                Didn't create an account? You can safely ignore this email.
              </td>
            </tr>

            ${sharedFooter()}

          </table>
        </td>
      </tr>

    </table>
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