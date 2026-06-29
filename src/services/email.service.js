const nodemailer = require("nodemailer");
const env = require("../config/env");

let cachedTransporter = null;

function isSmtpConfigured() {
  return Boolean(env.smtp.host);
}

function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure || env.smtp.port === 465,
    auth: env.smtp.user
      ? {
          user: env.smtp.user,
          pass: env.smtp.password || "",
        }
      : undefined,
  });

  return cachedTransporter;
}

function buildPasswordResetText({ name, resetUrl, expiresInMinutes }) {
  return `Hi ${name},

Click below link to reset your password.

${resetUrl}

This link expires in ${expiresInMinutes} minutes.

If you didn't request this, you can ignore this email.

— Coding Mastery`;
}

function buildPasswordResetHtml({ name, resetUrl, expiresInMinutes }) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f5f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 8px 24px rgba(15,23,42,0.06);overflow:hidden;">
          <tr>
            <td style="background:#2563eb;padding:20px 28px;color:#ffffff;font-weight:700;font-size:18px;">
              Coding <span style="color:#fdba74;">Mastery</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">Hi ${name},</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
                Click below link to reset your password.
              </p>
              <p style="margin:0 0 24px;">
                <a href="${resetUrl}"
                   style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:9999px;font-size:14px;">
                  Reset password
                </a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#475569;">Or copy this link:</p>
              <p style="margin:0 0 24px;word-break:break-all;">
                <a href="${resetUrl}" style="color:#2563eb;font-size:13px;">${resetUrl}</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#475569;">
                This link expires in <strong>${expiresInMinutes} minutes</strong>.
              </p>
              <p style="margin:0;font-size:13px;color:#94a3b8;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#f1f5f9;color:#94a3b8;font-size:12px;">
              &copy; ${new Date().getFullYear()} Coding Mastery
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send a password reset email. If SMTP isn't configured, the email body is
 * written to the server console (so dev still sees it without SMTP setup).
 *
 * Returns `{ transport: "smtp" | "console", messageId? }`.
 */
async function sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes }) {
  const subject = "Reset your Coding Mastery password";
  const text = buildPasswordResetText({ name, resetUrl, expiresInMinutes });
  const html = buildPasswordResetHtml({ name, resetUrl, expiresInMinutes });

  const transporter = getTransporter();
  if (!transporter) {
    console.log(
      `[email] SMTP not configured; would have sent reset email to ${to}:\n` +
        `--- begin email ---\nSubject: ${subject}\n\n${text}\n--- end email ---`
    );
    return { transport: "console" };
  }

  const info = await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    text,
    html,
  });
  console.log(`[email] Sent reset email to ${to} (messageId=${info.messageId})`);
  return { transport: "smtp", messageId: info.messageId };
}

module.exports = {
  sendPasswordResetEmail,
  isSmtpConfigured,
};
