/**
 * Content moderation utility.
 *
 * Three levels:
 *  HARD_BLOCK — content is rejected, post/comment not created
 *  FLAG       — content is published but marked autoFlagged=true for moderator review
 *  ALLOW      — content passes all checks
 *
 * WARN is handled client-side only (see frontend/lib/moderation.ts).
 */

/** Normalize text to catch basic evasion attempts (l33tspeak, asterisks, etc.) */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_]/g, '')          // remove masking chars
    .replace(/0/g, 'o')           // l33t: 0 → o
    .replace(/3/g, 'e')           // l33t: 3 → e
    .replace(/1/g, 'i')           // l33t: 1 → i
    .replace(/\$/g, 's')          // l33t: $ → s
    .replace(/@/g, 'a')           // l33t: @ → a
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Hard block patterns ────────────────────────────────────────────────────────
// These prevent publication entirely. Only patterns with zero legitimate use.

const HARD_BLOCK: RegExp[] = [
  // Bestemmie composte
  /\bporco\s*di[oò]\b/,
  /\bporco\s*ges[uù]\b/,
  /\bporco\s*cristo\b/,
  /\bporca\s*madonna\b/,
  /\bdi[oò]\s*cane\b/,
  /\bdi[oò]\s*porco\b/,
  /\bdi[oò]\s*boia\b/,
  /\bdi[oò]\s*bestia\b/,
  /\bdi[oò]\s*ladro\b/,
  /\bmadonn[ae]\s*(troi[ae]|puttan[ae])\b/,

  // Slur omofobi (nessun uso neutro come termine)
  /\bfroci[ao]?\b/,
  /\bricchion[ei]\b/,
  /\bculatton[ei]\b/,

  // Slur razziali
  /\bnegr[oaie]\b/,

  // Incitamento esplicito all'odio
  /\bmorte\s+ai\b/,
  /\bgas\s+(agli|alle|ai)\b/,
  /\bforni\s+per\s+(i|gli|le)\b/,
  /\bdevono\s+morire\s+(tutti|tutte)\b/,
];

// ── Flag patterns ──────────────────────────────────────────────────────────────
// Content is published but marked autoFlagged=true for moderator review.

const FLAG: RegExp[] = [
  /\bterron[ei]\b/,
  /\bpolenton[ei]\b/,
  /\bextracomunitari[oi]\b/,
  /\bfanculo\s+(agli?|alle?|ai)\b/,   // "fanculo ai [gruppo]" — targeted
  /\bvaffanculo\s+(agli?|alle?|ai)\b/,
];

// ── Public API ─────────────────────────────────────────────────────────────────

export type ModerationResult =
  | { action: 'ALLOW' }
  | { action: 'HARD_BLOCK'; reason: string }
  | { action: 'FLAG' };

export function moderateContent(text: string): ModerationResult {
  const normalized = normalize(text);

  for (const pattern of HARD_BLOCK) {
    if (pattern.test(normalized)) {
      return {
        action: 'HARD_BLOCK',
        reason: 'Il contenuto viola le linee guida della community e non può essere pubblicato.',
      };
    }
  }

  for (const pattern of FLAG) {
    if (pattern.test(normalized)) {
      return { action: 'FLAG' };
    }
  }

  return { action: 'ALLOW' };
}
