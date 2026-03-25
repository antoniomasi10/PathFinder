import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_NAME = process.env.EMAIL_FROM_NAME || 'PathFinder';
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'noreply@pathfinder.it';

function baseTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0F0F23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 520px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #1A1A2E; border-radius: 16px; padding: 40px 32px; border: 1px solid rgba(79, 70, 229, 0.2); }
    .logo { text-align: center; margin-bottom: 32px; }
    .logo h1 { color: #4F46E5; font-size: 28px; margin: 0; }
    .title { color: #FFFFFF; font-size: 22px; font-weight: 600; text-align: center; margin: 0 0 16px; }
    .text { color: #9CA3AF; font-size: 15px; line-height: 1.6; text-align: center; margin: 0 0 32px; }
    .code-box { background: #0F0F23; border: 2px solid #4F46E5; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 32px; }
    .code { font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #4F46E5; font-family: 'Courier New', monospace; }
    .warning { color: #6B7280; font-size: 13px; text-align: center; margin: 0; }
    .footer { text-align: center; padding-top: 24px; color: #4B5563; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo"><h1>PathFinder</h1></div>
      ${body}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} PathFinder. Tutti i diritti riservati.
    </div>
  </div>
</body>
</html>`;
}

export async function sendVerificationEmail(to: string, name: string, code: string): Promise<void> {
  const html = baseTemplate('Verifica la tua email', `
    <h2 class="title">Verifica la tua email</h2>
    <p class="text">Ciao <strong style="color:#fff">${name}</strong>, inserisci questo codice per verificare il tuo account:</p>
    <div class="code-box">
      <span class="code">${code}</span>
    </div>
    <p class="warning">Il codice scade tra 10 minuti. Se non hai richiesto questa verifica, ignora questa email.</p>
  `);

  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject: `${code} - Codice di verifica PathFinder`,
      html,
    });
    logger.info('Verification email sent', { to });
  } catch (error) {
    logger.error('Failed to send verification email', { to, error: String(error) });
    throw new Error('Impossibile inviare l\'email di verifica');
  }
}

export async function sendPasswordResetEmail(to: string, name: string, code: string): Promise<void> {
  const html = baseTemplate('Reimposta la tua password', `
    <h2 class="title">Reimposta la tua password</h2>
    <p class="text">Ciao <strong style="color:#fff">${name}</strong>, hai richiesto il reset della password. Usa questo codice:</p>
    <div class="code-box">
      <span class="code">${code}</span>
    </div>
    <p class="warning">Il codice scade tra 10 minuti. Se non hai richiesto il reset, ignora questa email e la tua password rimarrà invariata.</p>
  `);

  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject: 'Reimposta la tua password - PathFinder',
      html,
    });
    logger.info('Password reset email sent', { to });
  } catch (error) {
    logger.error('Failed to send password reset email', { to, error: String(error) });
    throw new Error('Impossibile inviare l\'email di reset password');
  }
}

export function generateOTP(): string {
  // Cryptographically secure 6-digit OTP
  const { randomInt } = require('crypto');
  return String(randomInt(100000, 999999));
}
