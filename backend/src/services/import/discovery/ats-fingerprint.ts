/**
 * ATS fingerprinting — detect which ATS (if any) powers a career page, and the
 * board token, from the page HTML + its final URL. Drives discovery routing:
 * permitted ATS → tier A; prohibited ATS → no-harvest; none → custom tier B/C.
 */
import { ATS_POLICY, AtsCompliance } from './ats-policy';

/** Subdomains that are not board tokens (e.g. apply.workable.com). */
const GENERIC_SUBDOMAINS = new Set([
  'apply', 'www', 'careers', 'career', 'jobs', 'job', 'boards', 'job-boards',
  'api', 'posting', 'postings', 'app', 'my', 'hire', 'talent',
]);

export interface Fingerprint {
  platform: string;
  compliance: AtsCompliance;
  token?: string;
}

/**
 * Scan text (career-page HTML and/or URL) for ATS signatures. Returns the first
 * match with a usable token; falls back to a platform-only match when a platform
 * is detected but no clean token can be extracted.
 */
export function fingerprintAts(text: string): Fingerprint | null {
  let platformOnly: Fingerprint | null = null;

  for (const entry of ATS_POLICY) {
    for (const re of entry.patterns) {
      const m = re.exec(text);
      if (!m) continue;
      const cand = m[1]?.toLowerCase();
      if (cand && !GENERIC_SUBDOMAINS.has(cand)) {
        return { platform: entry.platform, compliance: entry.compliance, token: cand };
      }
      if (!platformOnly) platformOnly = { platform: entry.platform, compliance: entry.compliance };
    }
  }
  return platformOnly;
}

/**
 * Heuristic tier for a custom (non-ATS) career page based on its static HTML:
 * "B" if the static markup already contains job-listing signals (cheap HTTP +
 * LLM), "C" if the page looks JS-rendered/empty (needs headless Chromium).
 */
export function classifyCustomTier(html: string): 'B' | 'C' {
  const lower = html.toLowerCase();
  const signals = ['intern', 'stage', 'tirocinio', 'trainee', 'graduate', 'apply', 'candidati', 'posizioni'];
  const hits = signals.filter(s => lower.includes(s)).length;
  // A near-empty body with a root mount point → SPA that renders client-side.
  const looksSpa = /<div[^>]+id=["'](root|app|__next)["']/i.test(html) && lower.replace(/\s/g, '').length < 4000;
  return hits >= 2 && !looksSpa ? 'B' : 'C';
}
