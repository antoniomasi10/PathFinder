import nodemailer from 'nodemailer';

const EMAIL_HTML = (code: string) => `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
    <h2 style="color:#4F46E5">Reset password PathFinder</h2>
    <p>Hai richiesto il reset della password. Usa il codice seguente:</p>
    <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;
                background:#f0f0f0;padding:20px;border-radius:8px;margin:20px 0">
      ${code}
    </div>
    <p style="color:#666;font-size:13px">Il codice scade tra <strong>15 minuti</strong>.</p>
    <p style="color:#666;font-size:13px">Se non hai richiesto il reset, ignora questa email.</p>
  </div>
`;

export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  let transporter: nodemailer.Transporter;
  let isEthereal = false;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development fallback: Ethereal (fake SMTP, email viewable via URL)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    isEthereal = true;
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"PathFinder" <noreply@pathfinder.app>',
    to: email,
    subject: 'Codice di verifica - PathFinder',
    html: EMAIL_HTML(code),
  });

  if (isEthereal) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('\n────────────────────────────────────────');
    console.log(`  [PASSWORD RESET] Email : ${email}`);
    console.log(`  [PASSWORD RESET] Codice: ${code}`);
    console.log(`  [PASSWORD RESET] Preview: ${previewUrl}`);
    console.log('────────────────────────────────────────\n');
  }
}
