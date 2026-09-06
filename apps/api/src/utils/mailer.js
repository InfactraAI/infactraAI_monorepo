const nodemailer = require('nodemailer');

const isConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

exports.isConfigured = isConfigured;

/**
 * Sends mail if SMTP is configured, and never rejects — a failed notification
 * must not fail the operation that triggered it. Returns whether it sent, so
 * callers can tell the user to pass a link along manually.
 */
exports.send = async (options) => {
  if (!isConfigured()) {
    console.warn('[mail] EMAIL_USER/EMAIL_PASS unset — skipping:', options.subject);
    return false;
  }

  try {
    await nodemailer
      .createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      })
      .sendMail(options);
    return true;
  } catch (err) {
    console.error('[mail] Send failed:', err.message);
    return false;
  }
};
