import { logger } from '../utils/logger';

const API_KEY = process.env.BREVO_API_KEY || '';
const FROM_NAME = process.env.BREVO_SENDER_NAME || 'COhA';
const FROM_EMAIL = process.env.BREVO_SENDER_EMAIL || 'info@cohaapp.com';

async function sendBrevoEmail(to: string, subject: string, html: string, replyTo?: string): Promise<void> {
  if (!API_KEY) return;
  const body: Record<string, any> = {
    sender: { name: FROM_NAME, email: FROM_EMAIL },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };
  if (replyTo) body.replyTo = { email: replyTo };
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': API_KEY },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Brevo API error ${response.status}: ${text}`);
  }
}

const LOGO_SVG = `<svg width="160" height="47" viewBox="0 0 278 81" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M154.883 54.5085C153.213 49.9054 152.268 47.1132 151.109 42.8142C150.567 43.3559 149.999 43.9021 149.373 44.4861L151.559 54.5085L154.329 67.5006C155.451 72.8814 156.169 75.681 158.576 80.1214H171.5C166.568 75.8072 163.751 73.0702 160.791 67.5006C158.506 63.2949 157.151 60.623 155.688 56.7357C155.425 56.0378 155.159 55.3007 154.883 54.5085Z" fill="#615FE2"/>
<path d="M150.636 41.0246C150.126 41.5326 149.574 42.0628 148.968 42.6301L149.373 44.4861C149.999 43.9021 150.567 43.3559 151.109 42.8142C150.956 42.2465 150.799 41.6525 150.636 41.0246Z" fill="#615FE2"/>
<path d="M154.883 54.5085C155.159 55.3007 155.425 56.0378 155.688 56.7357C156.108 52.3629 157.402 51.535 161.16 52.2813C166.201 53.6898 172.161 58.3305 184.425 68.6142L199.934 80.1214C204.01 80.373 205.989 79.6867 208.982 76.9662C210.683 74.9856 211.132 73.7336 211.567 71.3982V58.5917C206.746 61.5182 203.806 62.1686 198.273 62.1181C190.597 61.773 185.655 60.0272 175.932 54.6941C171.218 51.7571 168.589 51.0055 163.93 50.0541C158.546 49.2943 156.016 49.8827 154.883 54.5085Z" fill="#615FE2"/>
<path d="M149.373 44.4861L148.968 42.6301C140.923 48.5619 136.096 50.3697 127.187 52.1538C114.354 53.948 107.42 53.8721 95.7988 50.669C86.6752 47.3384 83.2025 43.6788 77.8889 36.1922V60.5059C83.9058 65.0266 88.3152 65.9975 97.6451 65.5171C111.671 64.1341 118.606 62.3331 129.218 57.165C137.505 52.9663 142.025 50.384 149.373 44.4861Z" fill="#615FE2"/>
<path d="M150.636 41.0246C149.485 36.8419 149.11 34.5112 148.605 30.566C147.4 22.2908 147.707 17.3186 154.144 12.7483C158.001 11.0864 159.627 11.1941 161.345 13.6763C164.478 18.9539 162.393 23.8227 156.914 33.35C154.911 36.2278 153.472 38.11 151.356 40.2954C151.125 40.5343 150.885 40.7768 150.636 41.0246C150.799 41.6525 150.956 42.2465 151.109 42.8142C152.795 41.127 154.223 39.4831 156.36 36.8764C170.249 18.6096 170.211 12.0426 165.038 2.72589C165.038 2.72589 163.745 0.684274 160.976 0.12748C158.206 -0.429314 155.893 0.91094 153.96 2.72589C145.594 12.3395 143.653 18.8761 146.943 33.35L148.968 42.6301C149.574 42.0628 150.126 41.5326 150.636 41.0246Z" fill="#615FE2"/>
<mask id="mask0_62_449" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="77" y="0" width="135" height="81">
<path d="M154.883 54.5085C153.213 49.9054 152.268 47.1132 151.109 42.8142C150.567 43.3559 149.999 43.9021 149.373 44.4861L151.559 54.5085L154.329 67.5006C155.451 72.8814 156.169 75.681 158.576 80.1214H171.5C166.568 75.8072 163.751 73.0702 160.791 67.5006C158.506 63.2949 157.151 60.623 155.688 56.7357C155.425 56.0378 155.159 55.3007 154.883 54.5085Z" fill="#615FE2"/>
<path d="M150.636 41.0246C150.126 41.5326 149.574 42.0628 148.968 42.6301L149.373 44.4861C149.999 43.9021 150.567 43.3559 151.109 42.8142C150.956 42.2465 150.799 41.6525 150.636 41.0246Z" fill="#615FE2"/>
<path d="M154.883 54.5085C155.159 55.3007 155.425 56.0378 155.688 56.7357C156.108 52.3629 157.402 51.535 161.16 52.2813C166.201 53.6897 172.161 58.3305 184.425 68.6142L199.934 80.1214C204.01 80.373 205.989 79.6867 208.982 76.9662C210.683 74.9856 211.132 73.7336 211.567 71.3982V58.5917C206.746 61.5182 203.806 62.1686 198.273 62.1181C190.597 61.7729 185.655 60.0271 175.932 54.6941C171.218 51.7571 168.589 51.0055 163.93 50.0541C158.546 49.2943 156.016 49.8827 154.883 54.5085Z" fill="#615FE2"/>
<path d="M149.373 44.4861L148.968 42.6301C140.923 48.5619 136.096 50.3697 127.187 52.1538C114.354 53.948 107.42 53.8721 95.7988 50.669C86.6752 47.3384 83.2024 43.6788 77.8889 36.1922V60.5059C83.9058 65.0266 88.3152 65.9975 97.6451 65.5171C111.671 64.1341 118.606 62.3331 129.218 57.165C137.505 52.9663 142.025 50.384 149.373 44.4861Z" fill="#615FE2"/>
<path d="M150.636 41.0246C149.485 36.8419 149.11 34.5112 148.605 30.566C147.4 22.2908 147.707 17.3186 154.144 12.7483C158.001 11.0864 159.627 11.194 161.345 13.6763C164.478 18.9539 162.393 23.8227 156.914 33.35C154.911 36.2278 153.472 38.11 151.356 40.2954C151.125 40.5343 150.885 40.7768 150.636 41.0246C150.799 41.6525 150.956 42.2465 151.109 42.8142C152.795 41.127 154.223 39.4831 156.36 36.8764C170.249 18.6096 170.211 12.0426 165.038 2.72589C165.038 2.72589 163.745 0.684274 160.976 0.12748C158.206 -0.429314 155.893 0.91094 153.96 2.72589C145.594 12.3395 143.653 18.8761 146.943 33.35L148.968 42.6301C149.574 42.0628 150.126 41.5326 150.636 41.0246Z" fill="#615FE2"/>
</mask>
<g mask="url(#mask0_62_449)">
<rect x="45.7649" y="18.8634" width="101.554" height="61.3062" fill="url(#paint0_linear_62_449)"/>
<rect x="149.993" y="40.3893" width="107.78" height="64.1629" fill="url(#paint1_linear_62_449)"/>
<rect x="142.729" y="-21.4287" width="55.0699" height="59.375" fill="url(#paint2_linear_62_449)" fill-opacity="0.75"/>
</g>
<path d="M82.977 67.4162C80.1614 67.4162 77.5394 66.9058 75.111 65.8852C72.7177 64.8645 70.6236 63.4391 68.8287 61.609C67.0337 59.7789 65.6259 57.632 64.6053 55.1683C63.6198 52.7047 63.1271 50.0123 63.1271 47.0911C63.1271 44.1699 63.6198 41.4775 64.6053 39.0139C65.5907 36.515 66.9809 34.3681 68.7759 32.5732C70.5708 30.743 72.6649 29.3352 75.0582 28.3498C77.4866 27.3291 80.1262 26.8188 82.977 26.8188C85.8278 26.8188 88.3794 27.2939 90.6319 28.2442C92.9196 29.1945 94.8553 30.4615 96.4391 32.0453C98.0229 33.629 99.1491 35.3888 99.8178 37.3245L92.5852 40.8088C91.9165 38.9083 90.7375 37.3421 89.0481 36.1103C87.394 34.8433 85.3703 34.2097 82.977 34.2097C80.6542 34.2097 78.6128 34.7553 76.8531 35.8463C75.0934 36.9374 73.7208 38.4507 72.7353 40.3865C71.785 42.287 71.3099 44.5219 71.3099 47.0911C71.3099 49.6603 71.785 51.9128 72.7353 53.8485C73.7208 55.7842 75.0934 57.2976 76.8531 58.3887C78.6128 59.4797 80.6542 60.0252 82.977 60.0252C85.3703 60.0252 87.394 59.4093 89.0481 58.1775C90.7375 56.9105 91.9165 55.3267 92.5852 53.4262L99.8178 56.9105C99.1491 58.8462 98.0229 60.6059 96.4391 62.1897C94.8553 63.7735 92.9196 65.0405 90.6319 65.9908C88.3794 66.941 85.8278 67.4162 82.977 67.4162ZM123.44 67.4162C120.484 67.4162 117.739 66.9058 115.205 65.8852C112.671 64.8645 110.453 63.4391 108.553 61.609C106.688 59.7437 105.227 57.5792 104.171 55.1155C103.115 52.6519 102.587 49.9771 102.587 47.0911C102.587 44.2051 103.098 41.5303 104.118 39.0666C105.174 36.603 106.635 34.4561 108.5 32.626C110.401 30.7958 112.618 29.3704 115.152 28.3498C117.686 27.3291 120.449 26.8188 123.44 26.8188C126.432 26.8188 129.195 27.3291 131.729 28.3498C134.263 29.3704 136.462 30.7958 138.328 32.626C140.228 34.4561 141.689 36.603 142.71 39.0666C143.765 41.5303 144.293 44.2051 144.293 47.0911C144.293 49.9771 143.765 52.6519 142.71 55.1155C141.654 57.5792 140.176 59.7437 138.275 61.609C136.41 63.4391 134.21 64.8645 131.676 65.8852C129.142 66.9058 126.397 67.4162 123.44 67.4162ZM123.44 60.0252C125.235 60.0252 126.889 59.7085 128.403 59.075C129.951 58.4415 131.306 57.5616 132.468 56.4353C133.629 55.2739 134.527 53.9013 135.16 52.3175C135.794 50.7338 136.111 48.9916 136.111 47.0911C136.111 45.1906 135.794 43.466 135.16 41.9174C134.527 40.3337 133.629 38.9611 132.468 37.7996C131.306 36.6382 129.951 35.7583 128.403 35.16C126.889 34.5265 125.235 34.2097 123.44 34.2097C121.645 34.2097 119.974 34.5265 118.425 35.16C116.912 35.7583 115.574 36.6382 114.413 37.7996C113.251 38.9611 112.354 40.3337 111.72 41.9174C111.087 43.466 110.77 45.1906 110.77 47.0911C110.77 48.9916 111.087 50.7338 111.72 52.3175C112.354 53.9013 113.251 55.2739 114.413 56.4353C115.574 57.5616 116.912 58.4415 118.425 59.075C119.974 59.7085 121.645 60.0252 123.44 60.0252ZM178.539 66.7827L191.842 27.4523H202.718L216.021 66.7827H207.099L204.46 58.7582H190.047L187.408 66.7827H178.539ZM192.317 51.6312H202.19L196.171 33.0483H198.389L192.317 51.6312Z" fill="#F8FAFC"/>
<defs>
<linearGradient id="paint0_linear_62_449" x1="196.776" y1="53.0534" x2="37.1922" y2="53.0534" gradientUnits="userSpaceOnUse">
<stop offset="0.240385" stop-color="#615FE2" stop-opacity="0.52"/>
<stop offset="0.602697" stop-color="#FBF8FF"/>
</linearGradient>
<linearGradient id="paint1_linear_62_449" x1="310.264" y1="76.1724" x2="140.895" y2="76.1724" gradientUnits="userSpaceOnUse">
<stop offset="0.649865" stop-color="#FBF8FF"/>
<stop offset="0.941702" stop-color="#615FE2" stop-opacity="0.52"/>
</linearGradient>
<linearGradient id="paint2_linear_62_449" x1="189.932" y1="-23.7725" x2="143.436" y2="26.5862" gradientUnits="userSpaceOnUse">
<stop stop-color="#FBF8FF"/>
<stop offset="0.870192" stop-color="#615FE2"/>
</linearGradient>
</defs>
</svg>`;

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
      <div class="logo">${LOGO_SVG}</div>
      ${body}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} COhA. Tutti i diritti riservati.
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
    await sendBrevoEmail(to, `${code} - Codice di verifica COhA`, html);
    logger.info('Verification email sent', { to });
  } catch (error) {
    logger.error('Failed to send verification email', { to, error: String(error) });
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
    await sendBrevoEmail(to, 'Reimposta la tua password - COhA', html);
    logger.info('Password reset email sent', { to });
  } catch (error) {
    logger.error('Failed to send password reset email', { to, error: String(error) });
  }
}

export async function sendContactEmail(
  userEmail: string,
  userName: string,
  subject: string,
  message: string,
): Promise<void> {
  const html = baseTemplate('Nuovo messaggio da Contattaci', `
    <h2 class="title">Nuovo messaggio di supporto</h2>
    <p class="text"><strong style="color:#fff">Da:</strong> ${userName} &lt;${userEmail}&gt;</p>
    <p class="text"><strong style="color:#fff">Oggetto:</strong> ${subject}</p>
    <div style="background:#0F0F23;border-radius:12px;padding:20px;margin-bottom:24px;text-align:left;">
      <p style="color:#D1D5DB;font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap;">${message}</p>
    </div>
    <p class="warning">Rispondi direttamente a questa email per contattare l'utente.</p>
  `);

  try {
    await sendBrevoEmail('info@cohaapp.com', `[Contattaci] ${subject}`, html, userEmail);
    logger.info('Contact email sent', { from: userEmail });
  } catch (error) {
    logger.error('Failed to send contact email', { from: userEmail, error: String(error) });
  }
}

export async function sendReportEmail(
  userEmail: string,
  userName: string,
  category: string,
  description: string,
): Promise<void> {
  const categoryLabels: Record<string, string> = {
    bug: 'Bug tecnico',
    content: 'Contenuto inappropriato',
    user: 'Problema con un utente',
    other: 'Altro',
  };
  const categoryLabel = categoryLabels[category] ?? category;

  const html = baseTemplate('Nuova segnalazione problema', `
    <h2 class="title">Nuova segnalazione</h2>
    <p class="text"><strong style="color:#fff">Da:</strong> ${userName} &lt;${userEmail}&gt;</p>
    <p class="text"><strong style="color:#fff">Categoria:</strong> ${categoryLabel}</p>
    <div style="background:#0F0F23;border-radius:12px;padding:20px;margin-bottom:24px;text-align:left;">
      <p style="color:#D1D5DB;font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap;">${description}</p>
    </div>
    <p class="warning">Rispondi direttamente a questa email per contattare l'utente.</p>
  `);

  try {
    await sendBrevoEmail('info@cohaapp.com', `[Segnalazione] ${categoryLabel}`, html, userEmail);
    logger.info('Report email sent', { from: userEmail, category });
  } catch (error) {
    logger.error('Failed to send report email', { from: userEmail, error: String(error) });
  }
}

export function generateOTP(): string {
  // Cryptographically secure 6-digit OTP
  const { randomInt } = require('crypto');
  return String(randomInt(100000, 999999));
}
