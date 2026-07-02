/**
 * Seed list of Italian (and Italy-hiring) companies known to run public ATS
 * boards. This is the Fase 1 ATS-index input: each entry is a *candidate* that
 * the discovery orchestrator VALIDATES against the live ATS API before adding
 * to the registry, so wrong/dead tokens are simply skipped (no pollution).
 *
 * The list is intentionally expandable — append entries here (or grow it from
 * external ATS indexes in Fase 2) and the next discovery run picks them up.
 *
 * Shape: [platform, token, displayName]
 */
export interface AtsSeedEntry {
  platform: string; // greenhouse | lever | ashby | workable | recruitee
  token: string;
  name: string;
}

export const ITALY_ATS_SEED: AtsSeedEntry[] = [
  // Italian scaleups / tech
  { platform: 'greenhouse', token: 'bendingspoons', name: 'Bending Spoons' },
  { platform: 'greenhouse', token: 'docebo', name: 'Docebo' },
  { platform: 'greenhouse', token: 'everli', name: 'Everli' },
  { platform: 'greenhouse', token: 'soldo', name: 'Soldo' },
  { platform: 'greenhouse', token: 'moneyfarm', name: 'Moneyfarm' },
  { platform: 'greenhouse', token: 'casavo', name: 'Casavo' },
  { platform: 'greenhouse', token: 'depop', name: 'Depop' },
  { platform: 'lever', token: 'scalapay', name: 'Scalapay' },
  { platform: 'lever', token: 'musixmatch', name: 'Musixmatch' },
  { platform: 'lever', token: 'satispay', name: 'Satispay' },
  { platform: 'ashby', token: 'faire', name: 'Faire' },
  { platform: 'workable', token: 'cortilia', name: 'Cortilia' },
  { platform: 'recruitee', token: 'sytadin', name: 'Sytadin' },
  // Italy-hiring international companies with strong intern programs
  { platform: 'greenhouse', token: 'yoox', name: 'YOOX NET-A-PORTER' },
  { platform: 'greenhouse', token: 'nexi', name: 'Nexi' },
];
