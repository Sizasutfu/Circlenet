// config/mailer.js
const isProd = process.env.NODE_ENV === 'production';

async function sendEmail({ from, to, subject, html }) {
  console.log(`[mailer] Sending email to ${to}, subject: ${subject}`);
  try {
    if (isProd) {
      // Production: Resend
     // console.log('[mailer] Using Resend');
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({ from, to, subject, html });
      if (error) {
       // console.error('[mailer] Resend error:', error);
        throw error;
      }
      // console.log('[mailer] Resend success, id:', data?.id);
    } else {
      // Development: Nodemailer with Gmail
     // console.log('[mailer] Using Nodemailer (Gmail)');
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
      const info = await transporter.sendMail({ from, to, subject, html });
      // console.log('[mailer] Nodemailer success, messageId:', info.messageId);
    }
  } catch (err) {
   // console.error('[mailer] Failed to send email:', err);
    throw err;
  }
}

module.exports = { sendEmail };