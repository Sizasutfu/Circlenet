const isProd = process.env.NODE_ENV === 'production';

async function sendEmail({ from, to, subject, html }) {
  if (isProd) {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from, to, subject, html });
  } else {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    await transporter.sendMail({ from, to, subject, html });
  }
}

module.exports = { sendEmail };