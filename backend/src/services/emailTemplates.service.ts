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
<path d="M154.883 54.5085C153.213 49.9054 152.268 47.1132 151.109 42.8142C150.567 43.3559 149.999 43.9021 149.373 44.4861L151.559 54.5085L154.329 67.5006C155.451 72.8814 156.169 75.681 158.576 80.1214H171.5C166.568 75.8072 163.751 73.0702 160.791 67.5006C158.506 63.2949 157.151 60.623 155.688 56.7357C155.425 56.0378 155.159 55.3007 154.883 54.5085Z" fill="#A5B4FC"/>
<path d="M150.636 41.0246C150.126 41.5326 149.574 42.0628 148.968 42.6301L149.373 44.4861C149.999 43.9021 150.567 43.3559 151.109 42.8142C150.956 42.2465 150.799 41.6525 150.636 41.0246Z" fill="#A5B4FC"/>
<path d="M154.883 54.5085C155.159 55.3007 155.425 56.0378 155.688 56.7357C156.108 52.3629 157.402 51.535 161.16 52.2813C166.201 53.6898 172.161 58.3305 184.425 68.6142L199.934 80.1214C204.01 80.373 205.989 79.6867 208.982 76.9662C210.683 74.9856 211.132 73.7336 211.567 71.3982V58.5917C206.746 61.5182 203.806 62.1686 198.273 62.1181C190.597 61.773 185.655 60.0272 175.932 54.6941C171.218 51.7571 168.589 51.0055 163.93 50.0541C158.546 49.2943 156.016 49.8827 154.883 54.5085Z" fill="#A5B4FC"/>
<path d="M149.373 44.4861L148.968 42.6301C140.923 48.5619 136.096 50.3697 127.187 52.1538C114.354 53.948 107.42 53.8721 95.7988 50.669C86.6752 47.3384 83.2025 43.6788 77.8889 36.1922V60.5059C83.9058 65.0266 88.3152 65.9975 97.6451 65.5171C111.671 64.1341 118.606 62.3331 129.218 57.165C137.505 52.9663 142.025 50.384 149.373 44.4861Z" fill="#A5B4FC"/>
<path d="M150.636 41.0246C149.485 36.8419 149.11 34.5112 148.605 30.566C147.4 22.2908 147.707 17.3186 154.144 12.7483C158.001 11.0864 159.627 11.1941 161.345 13.6763C164.478 18.9539 162.393 23.8227 156.914 33.35C154.911 36.2278 153.472 38.11 151.356 40.2954C151.125 40.5343 150.885 40.7768 150.636 41.0246C150.799 41.6525 150.956 42.2465 151.109 42.8142C152.795 41.127 154.223 39.4831 156.36 36.8764C170.249 18.6096 170.211 12.0426 165.038 2.72589C165.038 2.72589 163.745 0.684274 160.976 0.12748C158.206 -0.429314 155.893 0.91094 153.96 2.72589C145.594 12.3395 143.653 18.8761 146.943 33.35L148.968 42.6301C149.574 42.0628 150.126 41.5326 150.636 41.0246Z" fill="#A5B4FC"/>
<path d="M82.977 67.4162C80.1614 67.4162 77.5394 66.9058 75.111 65.8852C72.7177 64.8645 70.6236 63.4391 68.8287 61.609C67.0337 59.7789 65.6259 57.632 64.6053 55.1683C63.6198 52.7047 63.1271 50.0123 63.1271 47.0911C63.1271 44.1699 63.6198 41.4775 64.6053 39.0139C65.5907 36.515 66.9809 34.3681 68.7759 32.5732C70.5708 30.743 72.6649 29.3352 75.0582 28.3498C77.4866 27.3291 80.1262 26.8188 82.977 26.8188C85.8278 26.8188 88.3794 27.2939 90.6319 28.2442C92.9196 29.1945 94.8553 30.4615 96.4391 32.0453C98.0229 33.629 99.1491 35.3888 99.8178 37.3245L92.5852 40.8088C91.9165 38.9083 90.7375 37.3421 89.0481 36.1103C87.394 34.8433 85.3703 34.2097 82.977 34.2097C80.6542 34.2097 78.6128 34.7553 76.8531 35.8463C75.0934 36.9374 73.7208 38.4507 72.7353 40.3865C71.785 42.287 71.3099 44.5219 71.3099 47.0911C71.3099 49.6603 71.785 51.9128 72.7353 53.8485C73.7208 55.7842 75.0934 57.2976 76.8531 58.3887C78.6128 59.4797 80.6542 60.0252 82.977 60.0252C85.3703 60.0252 87.394 59.4093 89.0481 58.1775C90.7375 56.9105 91.9165 55.3267 92.5852 53.4262L99.8178 56.9105C99.1491 58.8462 98.0229 60.6059 96.4391 62.1897C94.8553 63.7735 92.9196 65.0405 90.6319 65.9908C88.3794 66.941 85.8278 67.4162 82.977 67.4162ZM123.44 67.4162C120.484 67.4162 117.739 66.9058 115.205 65.8852C112.671 64.8645 110.453 63.4391 108.553 61.609C106.688 59.7437 105.227 57.5792 104.171 55.1155C103.115 52.6519 102.587 49.9771 102.587 47.0911C102.587 44.2051 103.098 41.5303 104.118 39.0666C105.174 36.603 106.635 34.4561 108.5 32.626C110.401 30.7958 112.618 29.3704 115.152 28.3498C117.686 27.3291 120.449 26.8188 123.44 26.8188C126.432 26.8188 129.195 27.3291 131.729 28.3498C134.263 29.3704 136.462 30.7958 138.328 32.626C140.228 34.4561 141.689 36.603 142.71 39.0666C143.765 41.5303 144.293 44.2051 144.293 47.0911C144.293 49.9771 143.765 52.6519 142.71 55.1155C141.654 57.5792 140.176 59.7437 138.275 61.609C136.41 63.4391 134.21 64.8645 131.676 65.8852C129.142 66.9058 126.397 67.4162 123.44 67.4162ZM123.44 60.0252C125.235 60.0252 126.889 59.7085 128.403 59.075C129.951 58.4415 131.306 57.5616 132.468 56.4353C133.629 55.2739 134.527 53.9013 135.16 52.3175C135.794 50.7338 136.111 48.9916 136.111 47.0911C136.111 45.1906 135.794 43.466 135.16 41.9174C134.527 40.3337 133.629 38.9611 132.468 37.7996C131.306 36.6382 129.951 35.7583 128.403 35.16C126.889 34.5265 125.235 34.2097 123.44 34.2097C121.645 34.2097 119.974 34.5265 118.425 35.16C116.912 35.7583 115.574 36.6382 114.413 37.7996C113.251 38.9611 112.354 40.3337 111.72 41.9174C111.087 43.466 110.77 45.1906 110.77 47.0911C110.77 48.9916 111.087 50.7338 111.72 52.3175C112.354 53.9013 113.251 55.2739 114.413 56.4353C115.574 57.5616 116.912 58.4415 118.425 59.075C119.974 59.7085 121.645 60.0252 123.44 60.0252ZM178.539 66.7827L191.842 27.4523H202.718L216.021 66.7827H207.099L204.46 58.7582H190.047L187.408 66.7827H178.539ZM192.317 51.6312H202.19L196.171 33.0483H198.389L192.317 51.6312Z" fill="#F8FAFC"/>
</svg>`;

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

function typeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    TIROCINIO: '#bcbcff',
    SUMMERSHIP: '#c2e8ff',
    SUMMER_PROGRAM: '#ebe0f4',
    EVENT: '#f1f4e0',
    HACKATHON: '#e0f4e1',
    EXTRACURRICULAR: '#f4e8e0',
    FELLOWSHIP: '#f4e0f1',
    COMPETITION: '#f4e0e0',
    EXCHANGE: '#e0f4f0',
    VOLUNTEERING: '#ffe6d2',
    CONFERENCE: '#ffd9fc',
    BOOTCAMP: '#ffcaca',
    RESEARCH: '#babeff',
    SCHOLARSHIP: '#babeff',
    PROJECT: '#e0f4e1',
    CORSO: '#ffd9fc',
  };
  return colors[type?.toUpperCase()] ?? '#e1e1f2';
}

function baseTemplate(title: string, preheader: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');</style>
</head>
<body style="margin:0;padding:0;background-color:#F5F3FF;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F5F3FF">
    <tr><td align="center" style="padding:24px 16px 32px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td align="center" bgcolor="#4F46E5" style="background:linear-gradient(135deg,#4F46E5 0%,#6D28D9 100%);border-radius:20px 20px 0 0;padding:28px 32px 24px;">
          ${LOGO_SVG}
        </td></tr>

        <!-- Main card -->
        <tr><td bgcolor="#FFFFFF" style="border-radius:0 0 20px 20px;border:1px solid #E8E6FF;border-top:none;padding:32px 28px;">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding:20px 0 8px;">
          <p style="color:#94A3B8;font-size:12px;margin:0;font-family:'DM Sans',-apple-system,sans-serif;">
            &copy; ${new Date().getFullYear()} COhA. Tutti i diritti riservati.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function footerLinks(description: string, appUrl: string, ctaLabel: string, ctaHref: string, preferencesUrl: string, unsubscribeUrl: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
    <tr><td style="border-top:1px solid #ECEDFF;padding-top:24px;" align="center">
      <a href="${ctaHref}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;font-size:14px;font-weight:600;padding:13px 28px;border-radius:12px;text-decoration:none;">
        ${ctaLabel}
      </a>
    </td></tr>
    <tr><td align="center" style="padding-top:20px;">
      <p style="color:#94A3B8;font-size:12px;margin:0;line-height:1.7;">
        ${description}<br>
        <a href="${preferencesUrl}" style="color:#4F46E5;text-decoration:none;font-weight:500;">Gestisci preferenze</a>
        &nbsp;·&nbsp;
        <a href="${unsubscribeUrl}" style="color:#94A3B8;text-decoration:none;">Cancella iscrizione</a>
      </p>
    </td></tr>
  </table>`;
}

function renderOpportunityCard(opp: OpportunityCard, appUrl: string, showMatchScore: boolean): string {
  const company = opp.company || opp.organizer || '';
  const location = opp.isRemote ? 'Remote' : (opp.city || '');
  const days = opp.deadline ? daysUntil(opp.deadline) : null;
  const isUrgent = days !== null && days <= 7 && days > 0;
  const oppUrl = `${appUrl}/opportunities/${opp.id}`;
  const badgeBg = typeBadgeColor(opp.type);

  const deadlineTag = opp.deadline
    ? `<td style="padding-right:6px;">
        <span style="display:inline-block;background:${isUrgent ? '#FEF3C7' : '#F1F5F9'};color:${isUrgent ? '#92400E' : '#64748B'};font-size:12px;font-weight:500;padding:3px 10px;border-radius:100px;white-space:nowrap;">
          ${isUrgent ? `⚠ Scade tra ${days} giorn${days === 1 ? 'o' : 'i'}` : `Scade: ${formatDeadline(opp.deadline)}`}
        </span>
      </td>`
    : '';

  const scholarshipTag = opp.hasScholarship
    ? `<td>
        <span style="display:inline-block;background:#D1FAE5;color:#065F46;font-size:12px;font-weight:500;padding:3px 10px;border-radius:100px;">
          ✓ Borsa di studio
        </span>
      </td>`
    : '';

  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;background:#FAFAFE;border-radius:16px;border:1px solid #ECEDFF;">
    <tr><td style="padding:16px 20px 0 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            <span style="display:inline-block;background:${badgeBg};color:#4F5160;font-size:12px;font-weight:500;padding:4px 12px;border-radius:100px;">${opportunityTypeLabel(opp.type)}</span>
          </td>
          ${showMatchScore && opp.matchScore !== undefined ? `<td align="right" style="vertical-align:top;">
            <div style="color:#595E78;font-size:11px;font-weight:500;text-align:right;line-height:1.4;">Affinità</div>
            <div style="color:#4A4BD7;font-size:17px;font-weight:700;text-align:right;line-height:1.2;">${opp.matchScore}%</div>
          </td>` : ''}
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:10px 20px 0 20px;">
      <div style="color:#2C3149;font-size:16px;font-weight:700;line-height:1.3;">${opp.title}</div>
    </td></tr>
    ${company || location ? `<tr><td style="padding:4px 20px 0 20px;">
      <div style="color:#595E78;font-size:13px;">${[company, location].filter(Boolean).join(' · ')}</div>
    </td></tr>` : ''}
    ${(opp.deadline || opp.hasScholarship) ? `<tr><td style="padding:10px 20px 0 20px;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>${deadlineTag}${scholarshipTag}</tr></table>
    </td></tr>` : ''}
    <tr><td style="padding:14px 20px 18px 20px;">
      <a href="${oppUrl}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;font-size:13px;font-weight:600;padding:10px 22px;border-radius:10px;text-decoration:none;">
        Scopri opportunità →
      </a>
    </td></tr>
  </table>`;
}

// ── Weekly Digest ─────────────────────────────────────────────

export function renderWeeklyDigest(data: WeeklyDigestData): { subject: string; html: string } {
  const n = data.opportunities.length;
  const subject = `🔍 Le tue ${n} opportunità della settimana, ${data.firstName}`;

  const topMatch = data.opportunities[0];
  const topMatchBanner = topMatch?.matchScore && topMatch.matchScore >= 80
    ? `<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:14px 18px;text-align:center;margin-bottom:24px;">
        <span style="color:#4338CA;font-size:14px;font-weight:600;">✨ ${topMatch.matchScore}% di affinità con "${topMatch.title}"</span>
      </div>`
    : '';

  const cards = data.opportunities.map((opp) => renderOpportunityCard(opp, data.appUrl, true)).join('');

  const body = `
    <h1 style="color:#2C3149;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">Le tue opportunità della settimana</h1>
    <p style="color:#595E78;font-size:14px;text-align:center;margin:0 0 24px;">
      Ciao <strong style="color:#2C3149;">${data.firstName}</strong>, abbiamo trovato ${n} opportunità selezionate per te.
    </p>
    ${topMatchBanner}
    ${cards}
    ${footerLinks(
      'Hai ricevuto questa email perché hai attivato il digest settimanale.',
      data.appUrl,
      'Vedi tutte le opportunità →',
      `${data.appUrl}/home`,
      data.preferencesUrl,
      data.unsubscribeUrl,
    )}`;

  return { subject, html: baseTemplate(subject, `${n} nuove opportunità ti aspettano`, body) };
}

// ── Expiring Alert ────────────────────────────────────────────

export function renderExpiringAlert(data: ExpiringAlertData): { subject: string; html: string } {
  const n = data.opportunities.length;
  const subject = `⏰ ${n} opportunit${n === 1 ? 'à che hai salvata scade' : 'à che hai salvato scadono'} tra 5-7 giorni`;

  const cards = data.opportunities.map((opp) => renderOpportunityCard(opp, data.appUrl, false)).join('');

  const body = `
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:14px;padding:16px 20px;margin-bottom:24px;text-align:center;">
      <div style="font-size:24px;margin-bottom:6px;">⏰</div>
      <h1 style="color:#92400E;font-size:18px;font-weight:700;margin:0 0 4px;">Scadenza in arrivo</h1>
      <p style="color:#B45309;font-size:13px;margin:0;">Queste opportunità salvate scadono presto. Non perdere l'occasione!</p>
    </div>
    <p style="color:#595E78;font-size:14px;margin:0 0 20px;">
      Ciao <strong style="color:#2C3149;">${data.firstName}</strong>, ricordati di candidarti prima della scadenza.
    </p>
    ${cards}
    ${footerLinks(
      'Hai ricevuto questa email perché hai attivato gli avvisi di scadenza.',
      data.appUrl,
      'Vedi le opportunità salvate →',
      `${data.appUrl}/profile/saved-opportunities`,
      data.preferencesUrl,
      data.unsubscribeUrl,
    )}`;

  return { subject, html: baseTemplate(subject, `Non perdere queste opportunità in scadenza`, body) };
}

// ── Daily Opportunity ─────────────────────────────────────────

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
    <h1 style="color:#2C3149;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">Buongiorno, ${data.firstName}!</h1>
    <p style="color:#595E78;font-size:14px;text-align:center;margin:0 0 24px;">
      Ecco ${n === 1 ? "l'opportunità" : `le ${n} opportunità`} selezionata${n === 1 ? '' : 'e'} per te oggi.
    </p>
    ${cards}
    ${footerLinks(
      'Hai ricevuto questa email perché hai attivato il digest di opportunità.',
      data.appUrl,
      'Scopri tutte le opportunità →',
      `${data.appUrl}/home`,
      data.preferencesUrl,
      data.unsubscribeUrl,
    )}`;

  return { subject, html: baseTemplate(subject, `Nuove opportunità ti aspettano oggi`, body) };
}

// ── Spot Recommendation ───────────────────────────────────────

export interface SpotRecommendationData {
  firstName: string;
  opportunity: OpportunityCard;
  matchScore: number;
  appUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
}

export function renderSpotRecommendation(data: SpotRecommendationData): { subject: string; html: string } {
  const subject = `⚡ ${data.matchScore}% di affinità: "${data.opportunity.title}" — solo per te`;
  const card = renderOpportunityCard(data.opportunity, data.appUrl, true);

  const body = `
    <div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:14px;padding:16px 20px;margin-bottom:24px;text-align:center;">
      <div style="font-size:24px;margin-bottom:6px;">⚡</div>
      <h1 style="color:#3730A3;font-size:20px;font-weight:700;margin:0 0 4px;">${data.matchScore}% di affinità</h1>
      <p style="color:#4338CA;font-size:13px;margin:0;">Questa nuova opportunità è altamente compatibile con il tuo profilo.</p>
    </div>
    <p style="color:#595E78;font-size:14px;margin:0 0 20px;">
      Ciao <strong style="color:#2C3149;">${data.firstName}</strong>, abbiamo trovato qualcosa che fa esattamente per te.
    </p>
    ${card}
    <p style="color:#94A3B8;font-size:12px;text-align:center;margin:16px 0 0;font-style:italic;">
      Le opportunità fresche raccolgono candidature più rapidamente. Non aspettare!
    </p>
    ${footerLinks(
      'Hai ricevuto questa email perché hai attivato le raccomandazioni spot.',
      data.appUrl,
      'Vedi l\'opportunità →',
      `${data.appUrl}/opportunities/${data.opportunity.id}`,
      data.preferencesUrl,
      data.unsubscribeUrl,
    )}`;

  return { subject, html: baseTemplate(subject, `Match ${data.matchScore}% trovato per te`, body) };
}
