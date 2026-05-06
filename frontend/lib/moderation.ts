/**
 * Client-side content moderation — WARN level only.
 * Hard block and FLAG are enforced server-side.
 *
 * When warn words are detected, the UI shows a confirmation dialog before
 * allowing the user to publish. The user can choose to edit or proceed anyway.
 */

const WARN_PATTERNS: RegExp[] = [
  /\bcazz[oaie]\b/i,
  /\bfancul[oa]?\b/i,
  /\bvaffancul[oa]?\b/i,
  /\bvaffan\b/i,
  /\bstronz[oaie]\b/i,
  /\bminchi[ae]\b/i,
  /\bmerd[ae]\b/i,
  /\bputtan[ae]\b/i,
  /\btroi[ae]\b/i,
  /\bcoglion[ei]\b/i,
  /\bbastard[oaie]\b/i,
];

export function checkWarn(text: string): boolean {
  return WARN_PATTERNS.some((p) => p.test(text));
}
