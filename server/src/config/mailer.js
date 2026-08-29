const nodemailer = require("nodemailer");

let transporter = null;

// Lazily built so a missing SMTP config doesn't crash the whole server at
// boot — it only becomes a problem when a reset email is actually sent.
function getTransporter() {
    if (transporter) return transporter;

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        throw new Error(
            "SMTP is not configured — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in server/.env",
        );
    }

    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587/25
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    return transporter;
}

async function sendPasswordResetEmail(to, resetUrl) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    await getTransporter().sendMail({
        from: `AccioCall <${from}>`,
        to,
        subject: "Reset your AccioCall password",
        text: `Someone requested a password reset for this account.\n\nReset your password: ${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, you can ignore this email.`,
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color: #f59e0b;">AccioCall</h2>
                <p>Someone requested a password reset for this account.</p>
                <p><a href="${resetUrl}" style="display: inline-block; background: #fbbf24; color: #09090b; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none;">Reset password</a></p>
                <p style="color: #71717a; font-size: 13px;">This link expires in 30 minutes. If you didn't request this, you can ignore this email.</p>
            </div>
        `,
    });
}

module.exports = { sendPasswordResetEmail };
