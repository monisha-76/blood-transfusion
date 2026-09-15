const nodemailer = require('nodemailer');

// Initialize transporter using environment variables
const createTransporter = () => {
  const host = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const user = (process.env.EMAIL_USER || '').trim();
  // Strip any spaces from app password (e.g. Google's 4-character separated format: "xxxx xxxx xxxx xxxx")
  const pass = (process.env.EMAIL_PASSWORD || '').trim().replace(/\s+/g, '');

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // Safe fallback if credentials not configured
  return null;
};

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();
    const user = (process.env.EMAIL_USER || '').trim();
    let from = process.env.EMAIL_FROM ? process.env.EMAIL_FROM.trim() : '';

    // Validate from format; fallback to valid RFC format if needed
    if (!from || !from.includes('@')) {
      from = user ? `"JeevanSetu Blood System" <${user}>` : '"JeevanSetu Blood System" <notifications@jeevansetu.org>';
    }

    if (!transporter) {
      console.log(`[MOCK EMAIL SENT] To: ${to} | Subject: ${subject}`);
      return { success: true, mock: true };
    }

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: text || html.replace(/<[^>]*>?/gm, ''),
      html
    });

    console.log(`[EMAIL SUCCESS] MessageId: ${info.messageId} to ${to} | Subject: ${subject}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EMAIL FAILED] Failed to send email to ${to}: ${error.message}`);
    // Return error object instead of throwing so it never blocks workflows
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  createTransporter
};
