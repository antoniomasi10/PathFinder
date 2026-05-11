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
    STAGE: 'Stage',
    INTERNSHIP: 'Internship',
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
          <span style="color:#4F46E5;font-size:26px;font-weight:700;letter-spacing:-0.5px;">PathFinder</span>
        </td></tr>
        <!-- Card -->
        <tr><td bgcolor="#1A1A2E" style="border-radius:16px;border:1px solid rgba(79,70,229,0.25);padding:32px 28px;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td align="center" style="padding-top:24px;color:#4B5563;font-size:12px;line-height:1.6;">
          &copy; ${new Date().getFullYear()} PathFinder. Tutti i diritti riservati.<br>
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
