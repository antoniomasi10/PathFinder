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
  // Additional Italian fintech / foodtech / healthtech / proptech scaleups
  // (candidate tokens — validated against the live ATS API before registering,
  // so a wrong guess just gets skipped, never pollutes the registry)
  { platform: 'greenhouse', token: 'younited', name: 'Younited' },
  { platform: 'greenhouse', token: 'serenis', name: 'Serenis' },
  { platform: 'greenhouse', token: 'credimi', name: 'Credimi' },
  { platform: 'greenhouse', token: 'fiscozen', name: 'Fiscozen' },
  { platform: 'greenhouse', token: 'jakala', name: 'Jakala' },
  { platform: 'greenhouse', token: 'housfy', name: 'Housfy' },
  { platform: 'greenhouse', token: 'flowe', name: 'Flowe' },
  { platform: 'greenhouse', token: 'oval', name: 'Oval Money' },
  { platform: 'greenhouse', token: 'winelivery', name: 'Winelivery' },
  { platform: 'greenhouse', token: 'cassaincloud', name: 'Cassa in Cloud' },
  { platform: 'greenhouse', token: 'reverse', name: 'Reverse' },
  { platform: 'greenhouse', token: 'faceit', name: 'FACEIT' },
  { platform: 'lever', token: 'younited', name: 'Younited' },
  { platform: 'lever', token: 'housfy', name: 'Housfy' },
  { platform: 'lever', token: 'multiversity', name: 'Multiversity' },
  { platform: 'lever', token: 'tannico', name: 'Tannico' },
  { platform: 'lever', token: 'moneyfarm', name: 'Moneyfarm' },
  { platform: 'ashby', token: 'scalapay', name: 'Scalapay' },
  { platform: 'ashby', token: 'satispay', name: 'Satispay' },
  { platform: 'ashby', token: 'younited', name: 'Younited' },
  { platform: 'workable', token: 'brumbrum', name: 'BrumBrum' },
  { platform: 'workable', token: 'cashme', name: 'CashMe' },
  { platform: 'workable', token: 'tannico', name: 'Tannico' },
  { platform: 'recruitee', token: 'housfy', name: 'Housfy' },
  { platform: 'recruitee', token: 'cocoon', name: 'Cocoon' },
  { platform: 'personio', token: 'fiscozen', name: 'Fiscozen' },
  { platform: 'personio', token: 'serenis', name: 'Serenis' },
];
