/**
 * Curated Italian tech events seed — 2026 edition.
 *
 * Covers major Italian tech/innovation events not captured by automated importers.
 * These are added manually each year with verified=true.
 *
 * Run: npx ts-node --transpile-only prisma/seeds/curated-events-2026.ts
 *
 * Sources verified: official event websites only.
 * Update annually: add new editions when dates are confirmed.
 */
import { upsertManualOpportunity } from '../../src/services/import/manual.import';
import { logger } from '../../src/utils/logger';

const events = [

  // ── WE MAKE FUTURE ────────────────────────────────────────────────────────

  {
    title: 'We Make Future 2026 — Festival dell\'Innovazione e Tech',
    description: 'We Make Future è il più grande festival italiano dedicato a innovazione, startup, AI, digital marketing, sostenibilità e tech. Tre giorni di talk, workshop, networking ed espositori con oltre 100.000 visitatori e 1.500+ speaker. Evento imperdibile per studenti di tech, business, design e scienze sociali. L\'accesso base è gratuito con registrazione anticipata.',
    type: 'EVENT' as const,
    url: 'https://wemakefuture.it',
    organizer: 'We Make Future',
    location: 'Rimini, Italy',
    city: 'Rimini',
    country: 'IT',
    isAbroad: false,
    isRemote: false,
    format: 'IN_PERSON' as const,
    startDate: new Date('2026-06-25'),
    endDate: new Date('2026-06-27'),
    durationDays: 3,
    cost: 0,
    hasScholarship: false,
    eligibleFields: [] as any[],
    tags: ['we-make-future', 'innovation', 'startup', 'tech', 'ai', 'digital', 'networking', 'festival', 'italy', 'rimini'],
    sourceId: 'curated-wmf-2026',
  },

  // ── H-FARM ────────────────────────────────────────────────────────────────

  {
    title: 'H-Farm Open Day — Campus Innovation & Startup',
    description: 'H-Farm, uno dei maggiori hub europei per l\'innovazione digitale, ospita regolarmente Open Day gratuiti sul proprio campus a Roncade (Treviso). Gli eventi permettono a studenti e giovani professionisti di visitare il campus, incontrare startup residenti, partecipare a talk sull\'innovazione e fare networking con founder e investitori. Registrazione gratuita sul sito ufficiale.',
    type: 'EVENT' as const,
    url: 'https://www.hfarm.com/en/events',
    organizer: 'H-Farm',
    location: 'Roncade, Treviso, Italy',
    city: 'Roncade',
    country: 'IT',
    isAbroad: false,
    isRemote: false,
    format: 'IN_PERSON' as const,
    cost: 0,
    hasScholarship: false,
    eligibleFields: [] as any[],
    tags: ['h-farm', 'innovation', 'startup', 'campus', 'networking', 'open-day', 'treviso', 'italy'],
    sourceId: 'curated-hfarm-openday',
  },

  // ── SMAU ─────────────────────────────────────────────────────────────────

  {
    title: 'SMAU Milano 2026 — Fiera dell\'Innovazione e del Business Digitale',
    description: 'SMAU è la principale fiera italiana dedicata all\'innovazione tecnologica e al business digitale. Ospita centinaia di startup, PMI innovative, grandi aziende e PA in un evento annuale con talk, workshop e aree espositive. Accesso gratuito per studenti universitari con preregistrazione. Ideale per networking con il mondo dell\'innovazione italiana.',
    type: 'EVENT' as const,
    url: 'https://www.smau.it',
    organizer: 'SMAU',
    location: 'Milano, Italy',
    city: 'Milano',
    country: 'IT',
    isAbroad: false,
    isRemote: false,
    format: 'IN_PERSON' as const,
    cost: 0,
    hasScholarship: false,
    eligibleFields: [] as any[],
    tags: ['smau', 'innovation', 'digital', 'startup', 'fiera', 'networking', 'milano', 'italy'],
    sourceId: 'curated-smau-milano-2026',
  },

  // ── CODEMOTION ────────────────────────────────────────────────────────────

  {
    title: 'Codemotion Milano 2026 — Developer Conference',
    description: 'Codemotion è la più grande conferenza per sviluppatori in Italia, con talk su AI, cloud, web, mobile, DevOps e molto altro. Centinaia di speaker internazionali, workshop pratici e opportunità di networking con le principali aziende tech. Biglietti a pagamento ma con sconti studenti disponibili; alcuni slot sono gratuiti.',
    type: 'CONFERENCE' as const,
    url: 'https://conferences.codemotion.com/milan2026/',
    organizer: 'Codemotion',
    location: 'Milano, Italy',
    city: 'Milano',
    country: 'IT',
    isAbroad: false,
    isRemote: false,
    format: 'IN_PERSON' as const,
    cost: null,
    hasScholarship: false,
    eligibleFields: ['COMPUTER_SCIENCE', 'ENGINEERING'] as any[],
    tags: ['codemotion', 'developer', 'conference', 'tech', 'ai', 'cloud', 'web', 'milano', 'italy'],
    sourceId: 'curated-codemotion-milan-2026',
  },

];

async function run() {
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const event of events) {
    try {
      const result = await upsertManualOpportunity(event as any);
      if (result.action === 'created') created++;
      else updated++;
      logger.info(`[SeedEvents2026] ${result.action}: ${event.title.slice(0, 60)}`);
    } catch (err) {
      logger.error(`[SeedEvents2026] Failed: ${event.title.slice(0, 60)} — ${err}`);
      failed++;
    }
  }

  logger.info(`[SeedEvents2026] Done: ${created} created, ${updated} updated, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
