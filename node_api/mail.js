const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    // Dev: console transport
    transporter = { sendMail: async (opts) => { console.log('[mail stub] to=', opts.to, 'subject=', opts.subject); return true; } };
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT||587,10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  return transporter;
}

async function sendMail({to, subject, text, html}) {
  const t = getTransporter();
  try {
    await t.sendMail({ from: process.env.SMTP_FROM || 'no-reply@vbook.local', to, subject, text, html });
  } catch (e) { console.warn('Mail send failed (logged):', e.message || e); }
}

module.exports = { sendMail };
