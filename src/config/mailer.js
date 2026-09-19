const nodemailer = require('nodemailer');
const env = require('./env');

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
});

// Never log the `to` address or body — may contain a user's real email
// or, for the emergency module, a contact's details (rule: never log
// emergency contact details).
async function sendMail({ to, subject, text, html }) {
  return transporter.sendMail({ from: env.MAIL_FROM, to, subject, text, html });
}

module.exports = { sendMail };
