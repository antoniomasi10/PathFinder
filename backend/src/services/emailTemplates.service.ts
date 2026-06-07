export interface OpportunityCard {
  id: string;
  title: string;
  company?: string | null;
  organizer?: string | null;
  city?: string | null;
  isRemote: boolean;
  deadline?: Date | null;
  hasScholarship: boolean;
  type: string;
  matchScore?: number;
  matchReason?: string;
  url?: string | null;
}

export interface WeeklyDigestData {
  firstName: string;
  opportunities: OpportunityCard[];
  unsubscribeUrl: string;
  preferencesUrl: string;
  appUrl: string;
}

export interface ExpiringAlertData {
  firstName: string;
  opportunities: OpportunityCard[];
  unsubscribeUrl: string;
  preferencesUrl: string;
  appUrl: string;
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

function matchScoreColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#4F46E5';
  return '#6B7280';
}

function formatDeadline(deadline: Date): string {
  return deadline.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(deadline: Date): number {
  return Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function opportunityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    TIROCINIO: 'Tirocinio',
    FELLOWSHIP: 'Fellowship',
    HACKATHON: 'Hackathon',
    COMPETITION: 'Competizione',
    EXTRACURRICULAR: 'Extra',
    EVENT: 'Evento',
    SUMMER_PROGRAM: 'Summer Program',
    EXCHANGE: 'Exchange',
    VOLUNTEERING: 'Volontariato',
    CONFERENCE: 'Conferenza',
    BOOTCAMP: 'Bootcamp',
    RESEARCH: 'Ricerca',
  };
  return labels[type] || type;
}

function baseTemplate(title: string, preheader: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0F0F23;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0F0F23">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:24px;">
          ${LOGO_SVG}
        </td></tr>
        <!-- Card -->
        <tr><td bgcolor="#1A1A2E" style="border-radius:16px;border:1px solid rgba(79,70,229,0.25);padding:32px 28px;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td align="center" style="padding-top:24px;color:#4B5563;font-size:12px;line-height:1.6;">
          &copy; ${new Date().getFullYear()} COhA. Tutti i diritti riservati.<br>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderOpportunityCard(opp: OpportunityCard, appUrl: string, showMatchScore: boolean): string {
  const company = opp.company || opp.organizer || '';
  const location = opp.isRemote ? 'Remote' : (opp.city || '');
  const days = opp.deadline ? daysUntil(opp.deadline) : null;
  const isUrgent = days !== null && days <= 7 && days > 0;
  const scoreColor = opp.matchScore !== undefined ? matchScoreColor(opp.matchScore) : '#6B7280';
  const oppUrl = `${appUrl}/opportunities/${opp.id}`;

  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;background:#0F0F23;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
    <tr><td style="padding:20px 20px 0 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <span style="display:inline-block;background:rgba(79,70,229,0.15);color:#818CF8;font-size:11px;font-weight:600;padding:3px 8px;border-radius:6px;text-transform:uppercase;letter-spacing:0.5px;">${opportunityTypeLabel(opp.type)}</span>
          </td>
          ${showMatchScore && opp.matchScore !== undefined ? `<td align="right">
            <span style="display:inline-block;background:${scoreColor}22;color:${scoreColor};font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;">${opp.matchScore}% match</span>
          </td>` : ''}
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:10px 20px 0 20px;">
      <div style="color:#FFFFFF;font-size:16px;font-weight:700;line-height:1.3;">${opp.title}</div>
    </td></tr>
    ${company || location ? `<tr><td style="padding:4px 20px 0 20px;">
      <div style="color:#9CA3AF;font-size:13px;">${[company, location].filter(Boolean).join(' · ')}</div>
    </td></tr>` : ''}
    ${opp.matchReason ? `<tr><td style="padding:8px 20px 0 20px;">
      <div style="color:#818CF8;font-size:13px;font-style:italic;">${opp.matchReason}</div>
    </td></tr>` : ''}
    <tr><td style="padding:12px 20px 0 20px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          ${opp.deadline ? `<td style="padding-right:12px;">
            <span style="color:${isUrgent ? '#F59E0B' : '#6B7280'};font-size:12px;">
              ${isUrgent ? `⚠️ Scade tra ${days} giorn${days === 1 ? 'o' : 'i'}` : `⏰ Scade: ${formatDeadline(opp.deadline)}`}
            </span>
          </td>` : ''}
          ${opp.hasScholarship ? `<td>
            <span style="color:#10B981;font-size:12px;">✓ Borsa di studio</span>
          </td>` : ''}
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 20px 20px 20px;">
      <a href="${oppUrl}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;">
        Scopri opportunità →
      </a>
    </td></tr>
  </table>`;
}

export function renderWeeklyDigest(data: WeeklyDigestData): { subject: string; html: string } {
  const n = data.opportunities.length;
  const subject = `🔍 Le tue ${n} opportunità della settimana, ${data.firstName}`;

  const topMatch = data.opportunities[0];
  const topMatchBanner = topMatch?.matchScore && topMatch.matchScore >= 80
    ? `<tr><td style="padding-bottom:20px;">
        <div style="background:rgba(79,70,229,0.15);border:1px solid rgba(79,70,229,0.3);border-radius:10px;padding:14px 16px;text-align:center;">
          <span style="color:#818CF8;font-size:14px;font-weight:600;">✨ Match del ${topMatch.matchScore}% con "${topMatch.title}"</span>
        </div>
      </td></tr>`
    : '';

  const cards = data.opportunities.map((opp) => renderOpportunityCard(opp, data.appUrl, true)).join('');

  const body = `
    <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">Le tue opportunità di questa settimana</h1>
    <p style="color:#9CA3AF;font-size:14px;text-align:center;margin:0 0 24px;">
      Ciao <strong style="color:#fff;">${data.firstName}</strong>, abbiamo trovato ${n} opportunità selezionate per te basandoci sul tuo profilo.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${topMatchBanner}
      <tr><td>${cards}</td></tr>
      <tr><td style="padding-top:8px;padding-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="border-top:1px solid rgba(255,255,255,0.1);padding-top:20px;" align="center">
            <a href="${data.appUrl}/home" style="display:inline-block;border:1px solid #4F46E5;color:#818CF8;font-size:13px;font-weight:600;padding:10px 24px;border-radius:8px;text-decoration:none;">
              Vedi tutte le opportunità →
            </a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding-top:8px;">
        <p style="color:#4B5563;font-size:12px;margin:0;line-height:1.6;">
          Hai ricevuto questa email perché hai attivato il digest settimanale.<br>
          <a href="${data.preferencesUrl}" style="color:#6B7280;text-decoration:underline;">Gestisci preferenze</a>
          &nbsp;·&nbsp;
          <a href="${data.unsubscribeUrl}" style="color:#6B7280;text-decoration:underline;">Cancella iscrizione</a>
        </p>
      </td></tr>
    </table>`;

  return { subject, html: baseTemplate(subject, `${n} nuove opportunità ti aspettano`, body) };
}

export function renderExpiringAlert(data: ExpiringAlertData): { subject: string; html: string } {
  const n = data.opportunities.length;
  const subject = `⏰ ${n} opportunit${n === 1 ? 'à che hai salvata scade' : 'à che hai salvato scadono'} tra 5-7 giorni`;

  const cards = data.opportunities.map((opp) => renderOpportunityCard(opp, data.appUrl, false)).join('');

  const body = `
    <div style="background:linear-gradient(135deg,#92400E,#78350F);border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:center;">
      <span style="color:#FEF3C7;font-size:20px;">⏰</span>
      <h1 style="color:#FEF3C7;font-size:20px;font-weight:700;margin:8px 0 4px;">Scadenza in arrivo</h1>
      <p style="color:#FDE68A;font-size:13px;margin:0;">Queste opportunità salvate scadono presto. Non perdere l'occasione!</p>
    </div>
    <p style="color:#9CA3AF;font-size:14px;margin:0 0 20px;">
      Ciao <strong style="color:#fff;">${data.firstName}</strong>, ricordati di candidarti prima della scadenza.
    </p>
    ${cards}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
      <tr><td style="border-top:1px solid rgba(255,255,255,0.1);padding-top:20px;" align="center">
        <a href="${data.appUrl}/profile" style="display:inline-block;border:1px solid #F59E0B;color:#FCD34D;font-size:13px;font-weight:600;padding:10px 24px;border-radius:8px;text-decoration:none;">
          Vedi tutte le opportunità salvate →
        </a>
      </td></tr>
      <tr><td align="center" style="padding-top:20px;">
        <p style="color:#4B5563;font-size:12px;margin:0;line-height:1.6;">
          Hai ricevuto questa email perché hai attivato gli avvisi di scadenza.<br>
          <a href="${data.preferencesUrl}" style="color:#6B7280;text-decoration:underline;">Gestisci preferenze</a>
          &nbsp;·&nbsp;
          <a href="${data.unsubscribeUrl}" style="color:#6B7280;text-decoration:underline;">Cancella iscrizione</a>
        </p>
      </td></tr>
    </table>`;

  return { subject, html: baseTemplate(subject, `Non perdere queste opportunità in scadenza`, body) };
}

// ── Daily Opportunity ────────────────────────────────────────

export interface DailyOpportunityData {
  firstName: string;
  opportunities: OpportunityCard[];
  appUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
}

export function renderDailyOpportunity(data: DailyOpportunityData): { subject: string; html: string } {
  const n = data.opportunities.length;
  const subject = `☀️ Le tue opportunità di oggi, ${data.firstName}`;
  const cards = data.opportunities.map((opp) => renderOpportunityCard(opp, data.appUrl, true)).join('');

  const body = `
    <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">Buongiorno, ${data.firstName}!</h1>
    <p style="color:#9CA3AF;font-size:14px;text-align:center;margin:0 0 24px;">
      Ecco ${n === 1 ? "l'opportunità" : `le ${n} opportunità`} selezionata${n === 1 ? '' : 'e'} per te oggi.
    </p>
    ${cards}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
      <tr><td style="border-top:1px solid rgba(255,255,255,0.1);padding-top:20px;" align="center">
        <a href="${data.appUrl}/home" style="display:inline-block;border:1px solid #4F46E5;color:#818CF8;font-size:13px;font-weight:600;padding:10px 24px;border-radius:8px;text-decoration:none;">
          Scopri tutte le opportunità →
        </a>
      </td></tr>
      <tr><td align="center" style="padding-top:20px;">
        <p style="color:#4B5563;font-size:12px;margin:0;line-height:1.6;">
          Hai ricevuto questa email perché hai attivato il digest di opportunità.<br>
          <a href="${data.preferencesUrl}" style="color:#6B7280;text-decoration:underline;">Gestisci preferenze</a>
          &nbsp;·&nbsp;
          <a href="${data.unsubscribeUrl}" style="color:#6B7280;text-decoration:underline;">Cancella iscrizione</a>
        </p>
      </td></tr>
    </table>`;

  return { subject, html: baseTemplate(subject, `Nuove opportunità ti aspettano oggi`, body) };
}

// ── Spot Recommendation ──────────────────────────────────────

export interface SpotRecommendationData {
  firstName: string;
  opportunity: OpportunityCard;
  matchScore: number;
  appUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
}

export function renderSpotRecommendation(data: SpotRecommendationData): { subject: string; html: string } {
  const subject = `⚡ Match ${data.matchScore}%: "${data.opportunity.title}" — solo per te`;
  const scoreColor = matchScoreColor(data.matchScore);
  const card = renderOpportunityCard(data.opportunity, data.appUrl, true);

  const body = `
    <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:center;">
      <span style="color:#10B981;font-size:22px;">⚡</span>
      <h1 style="color:#10B981;font-size:20px;font-weight:700;margin:8px 0 4px;">Match del ${data.matchScore}%</h1>
      <p style="color:#6EE7B7;font-size:13px;margin:0;">Questa nuova opportunità è altamente compatibile con il tuo profilo.</p>
    </div>
    <p style="color:#9CA3AF;font-size:14px;margin:0 0 20px;">
      Ciao <strong style="color:#fff;">${data.firstName}</strong>, abbiamo trovato qualcosa che fa esattamente per te.
    </p>
    ${card}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
      <tr><td style="border-top:1px solid rgba(255,255,255,0.1);padding-top:20px;">
        <p style="color:#6B7280;font-size:12px;text-align:center;margin:0 0 16px;font-style:italic;">
          Le opportunità fresche raccolgono candidature più rapidamente. Non aspettare!
        </p>
      </td></tr>
      <tr><td align="center" style="padding-top:8px;">
        <p style="color:#4B5563;font-size:12px;margin:0;line-height:1.6;">
          Hai ricevuto questa email perché hai attivato le raccomandazioni spot.<br>
          <a href="${data.preferencesUrl}" style="color:#6B7280;text-decoration:underline;">Gestisci preferenze</a>
          &nbsp;·&nbsp;
          <a href="${data.unsubscribeUrl}" style="color:#6B7280;text-decoration:underline;">Cancella iscrizione</a>
        </p>
      </td></tr>
    </table>`;

  return { subject, html: baseTemplate(subject, `Match ${data.matchScore}% trovato per te`, body) };
}
