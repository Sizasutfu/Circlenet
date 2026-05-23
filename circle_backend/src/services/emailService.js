const { sendEmail } = require('../config/mailer');

const FROM = process.env.NODE_ENV === 'production'
  ? '"Circle" <noreply@circlenet.social>'
  : `"Circle" <${process.env.EMAIL_USER}>`;

async function sendPasswordResetEmail({ to, name, token }) {
  const resetUrl = `${process.env.FRONTEND_URL}/?token=${token}`;

  await sendEmail({
    from: FROM,
    to,
    subject: 'Reset your Circle password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#7c6bff">Reset your password</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your Circle password.
           Click the button below — this link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 28px;
                  background:#7c6bff;color:#fff;border-radius:8px;
                  text-decoration:none;font-weight:600">
          Reset Password
        </a>
        <p style="color:#888;font-size:13px">
          If you didn't request this, you can safely ignore this email.<br/>
          The link will expire in 1 hour.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#aaa;font-size:12px">Circle · sent to ${to}</p>
      </div>
    `,
  });
}

async function sendVerificationEmail({ to, name, code }) {
  await sendEmail({
    from: FROM,
    to,
    subject: 'Verify your Circle email',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#7c6bff">Verify your email</h2>
        <p>Hi ${name},</p>
        <p>Thanks for joining Circle! Enter this code to verify your email address.
           It expires in <strong>15 minutes</strong>.</p>
        <div style="margin:28px 0;text-align:center">
          <span style="display:inline-block;padding:16px 36px;background:#f3f0ff;
                       border-radius:12px;font-size:32px;font-weight:700;
                       letter-spacing:10px;color:#7c6bff">${code}</span>
        </div>
        <p style="color:#888;font-size:13px">
          If you didn't create a Circle account, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#aaa;font-size:12px">Circle · sent to ${to}</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail };