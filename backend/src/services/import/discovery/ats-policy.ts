/**
 * ATS compliance policy — single source of truth for which ATS platforms we may
 * import from vs. which explicitly prohibit scraping.
 *
 *  - PERMITTED: public APIs whose ToS allow programmatic access → direct tier-A
 *    import via the ATS factory.
 *  - PROHIBITED: platforms whose ToS explicitly ban automated access (Workday,
 *    SuccessFactors, Taleo, iCIMS). We NEVER scrape or import from these. When a
 *    company's careers page is detected on one, the company is registered as a
 *    known target but flagged `no-harvest` (see registerScrapeTarget); we only
 *    harvest it if it also exposes a non-ATS page of its own.
 *
 * Each entry carries URL/HTML fingerprint patterns; the first capture group, when
 * present and not a generic subdomain, is the board token.
 */
export type AtsCompliance = 'permitted' | 'prohibited';

export interface AtsPolicyEntry {
  platform: string;
  compliance: AtsCompliance;
  patterns: RegExp[];
}

export const ATS_POLICY: AtsPolicyEntry[] = [
  // --- Permitted public APIs (direct tier-A import) ---
  { platform: 'greenhouse', compliance: 'permitted', patterns: [
    /boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9_-]+)/i,
    /(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i,
    /greenhouse\.io\/embed\/job_board\?for=([a-z0-9_-]+)/i,
  ]},
  { platform: 'lever', compliance: 'permitted', patterns: [
    /api\.lever\.co\/v0\/postings\/([a-z0-9_-]+)/i,
    /jobs\.lever\.co\/([a-z0-9_-]+)/i,
  ]},
  { platform: 'ashby', compliance: 'permitted', patterns: [
    /api\.ashbyhq\.com\/posting-api\/job-board\/([a-z0-9_-]+)/i,
    /jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i,
  ]},
  { platform: 'workable', compliance: 'permitted', patterns: [
    /apply\.workable\.com\/([a-z0-9_-]+)/i,
    /([a-z0-9_-]+)\.workable\.com/i,
  ]},
  { platform: 'personio', compliance: 'permitted', patterns: [
    /([a-z0-9_-]+)\.jobs\.personio\.(?:com|de)/i,
  ]},
  { platform: 'smartrecruiters', compliance: 'permitted', patterns: [
    /(?:jobs|careers)\.smartrecruiters\.com\/([a-z0-9_-]+)/i,
  ]},
  { platform: 'recruitee', compliance: 'permitted', patterns: [
    /([a-z0-9_-]+)\.recruitee\.com/i,
  ]},

  // --- Prohibited (explicit anti-scraping ToS) — company signal only ---
  { platform: 'workday', compliance: 'prohibited', patterns: [
    /([a-z0-9_-]+)\.[a-z0-9_-]*\.?myworkdayjobs\.com/i,
    /myworkdaysite\.com/i,
  ]},
  { platform: 'successfactors', compliance: 'prohibited', patterns: [
    /careers\d*\.successfactors\.(?:com|eu)/i,
    /\.successfactors\.(?:com|eu)/i,
  ]},
  { platform: 'taleo', compliance: 'prohibited', patterns: [
    /\.taleo\.net/i,
  ]},
  { platform: 'icims', compliance: 'prohibited', patterns: [
    /\.icims\.com/i,
  ]},
];

export const PERMITTED_ATS = new Set(ATS_POLICY.filter(e => e.compliance === 'permitted').map(e => e.platform));
export const PROHIBITED_ATS = new Set(ATS_POLICY.filter(e => e.compliance === 'prohibited').map(e => e.platform));

export function atsCompliance(platform: string): AtsCompliance | 'unknown' {
  const e = ATS_POLICY.find(p => p.platform === platform);
  return e ? e.compliance : 'unknown';
}
