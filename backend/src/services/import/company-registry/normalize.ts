/**
 * Name/domain normalization shared by every registry loader — keeps cross-source
 * dedup (ingest.ts) consistent regardless of how each open-data source formats
 * company names and URLs.
 */

/** Italian legal-form suffixes/prefixes to strip before comparing names. */
const LEGAL_FORM_RE = /\b(s\.?p\.?a\.?|s\.?r\.?l\.?(?:\s*s\.?(?:u|b)\.?)?|s\.?a\.?s\.?|s\.?n\.?c\.?|s\.?a\.?p\.?a\.?|soc(?:ietà|\.)\s*coop(?:erativa)?(?:\s*a\s*r\.?l\.?)?|società\s+cooperativa|group|holding)\b\.?/gi;

/** Hosts that are never a company's own site — webmail, socials, page builders, marketplaces. */
const DOMAIN_BLOCKLIST = new Set([
  'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com',
  'youtube.com', 'tiktok.com', 'wixsite.com', 'weebly.com', 'blogspot.com',
  'godaddysites.com', 'business.site', 'gmail.com', 'yahoo.com', 'libero.it',
  'virgilio.it', 'pec.it', 'legalmail.it', 'amazon.it', 'ebay.it',
]);

/** Lowercase, strip legal-form suffixes/accents/punctuation for fuzzy name matching. */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(LEGAL_FORM_RE, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract a normalized apex domain (registrable domain, no subdomain/www) from a
 * raw URL string. Returns null when the URL is malformed or points at a blocked
 * host (socials, webmail, page builders) — callers should treat that as
 * "no usable domain", not fall back to guessing.
 */
export function extractApexDomain(rawUrl: string): string | null {
  if (!rawUrl) return null;
  let url: URL;
  try {
    url = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`);
  } catch {
    return null;
  }
  let host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!host || !host.includes('.')) return null;

  // Strip to the registrable domain (last two labels) — good enough for .it/.com/.eu
  // apex domains; multi-part Italian TLDs (co.it doesn't exist) don't need a public suffix list here.
  const parts = host.split('.');
  if (parts.length > 2) host = parts.slice(-2).join('.');

  if (DOMAIN_BLOCKLIST.has(host)) return null;
  return host;
}
