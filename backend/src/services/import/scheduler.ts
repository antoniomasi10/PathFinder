/**
 * Import Scheduler
 *
 * Cron schedules:
 * - EU Youth/Eurodesk: weekly Monday 03:30 | SmartRecruiters: weekly Monday 04:00
 * - Arbeitnow: weekly Tuesday 03:30 | RemoteOK: weekly Tuesday 04:00
 * - Stage4eu: weekly Wednesday 03:30
 * - Greenhouse: weekly Thursday 03:30 | Jobicy: weekly Thursday 04:00
 * - Lever: weekly Friday 03:30 | FashionUnited: weekly Friday 04:00
 * - Ashby: weekly Saturday 03:30 | Workable: weekly Saturday 04:00
 * - Personio: weekly Sunday 03:30 | Cleanup: weekly Sunday 05:00
 * - MUR universities: 1st of each month at 02:00
 * - MUR courses: 1st of each month at 02:30
 * - AlmaLaurea stats: quarterly (1st Jan, Apr, Jul, Oct at 04:00)
 *
 * NOTE: EURES scraper disabled — no public API available.
 * Existing EURES data remains in DB as static cache.
 *
 * REMOVED: Bundesagentur — unofficial reverse-engineered API, BA explicitly opposed automated access.
 * REMOVED: The Muse — ToS Section 3.3 prohibits replicating services. Replaced by Jobicy.
 */
import cron from 'node-cron';
import { importUniversities, importCourses } from './mur.import';
import { importEUOpportunities } from './eu-youth.import';
import { importStage4euOpportunities } from './stage4eu.import';
import { importGreenhouseOpportunities } from './greenhouse.import';
import { importLeverOpportunities } from './lever.import';
import { importAshbyOpportunities } from './ashby.import';
import { importWorkableOpportunities } from './workable.import';
import { importPersonioOpportunities } from './personio.import';
import { importArbeitnowOpportunities } from './arbeitnow.import';
import { importRemoteOKOpportunities } from './remoteok.import';
import { importJobicyOpportunities } from './jobicy.import';
import { importFashionUnitedOpportunities } from './fashionunited.import';
import { importSmartRecruitersOpportunities } from './smartrecruiters.import';
import { importAlmaLaureaStats } from './almalaurea.import';
import { runCleanup } from './cleanup.service';
import { alertImportFailure } from './alerting';
import { logger } from '../../utils/logger';

async function runWithAlert(name: string, source: string, type: string, fn: () => Promise<any>) {
  try {
    const result = await fn();
    logger.info(`[Scheduler] ${name}: ${JSON.stringify(result)}`);
  } catch (err: any) {
    logger.error(`[Scheduler] ${name} failed: ${err}`);
    alertImportFailure(source, type, String(err)).catch(() => {});
  }
}

export function startImportScheduler() {
  // EURES: disabled — no public API, data kept as static cache in DB
  // Bundesagentur: REMOVED — unofficial reverse-engineered API, BA explicitly opposed automated access
  // The Muse: REMOVED — ToS Section 3.3 prohibits replicating services

  // Weekly Monday: EU Youth + Eurodesk (03:30)
  cron.schedule('30 3 * * 1', () => {
    runWithAlert('EU Youth', 'eu-youth', 'opportunities', importEUOpportunities);
  });

  // Weekly Monday: SmartRecruiters enterprise/German industrial (04:00)
  cron.schedule('0 4 * * 1', () => {
    runWithAlert('SmartRecruiters', 'smartrecruiters', 'opportunities', importSmartRecruitersOpportunities);
  });

  // Weekly Wednesday: Stage4eu (03:30)
  cron.schedule('30 3 * * 3', () => {
    runWithAlert('Stage4eu', 'stage4eu', 'opportunities', importStage4euOpportunities);
  });

  // Weekly Thursday: Greenhouse internships (03:30)
  cron.schedule('30 3 * * 4', () => {
    runWithAlert('Greenhouse', 'greenhouse', 'opportunities', importGreenhouseOpportunities);
  });

  // Weekly Thursday: Jobicy remote internships (04:00)
  cron.schedule('0 4 * * 4', () => {
    runWithAlert('Jobicy', 'jobicy', 'opportunities', importJobicyOpportunities);
  });

  // Weekly Friday: Lever internships (03:30)
  cron.schedule('30 3 * * 5', () => {
    runWithAlert('Lever', 'lever', 'opportunities', importLeverOpportunities);
  });

  // Weekly Friday: FashionUnited fashion internships (04:00)
  cron.schedule('0 4 * * 5', () => {
    runWithAlert('FashionUnited', 'fashionunited', 'opportunities', importFashionUnitedOpportunities);
  });

  // Weekly Saturday: Ashby internships (03:30)
  cron.schedule('30 3 * * 6', () => {
    runWithAlert('Ashby', 'ashby', 'opportunities', importAshbyOpportunities);
  });

  // Weekly Saturday: Workable internships (04:00)
  cron.schedule('0 4 * * 6', () => {
    runWithAlert('Workable', 'workable', 'opportunities', importWorkableOpportunities);
  });

  // Weekly Sunday: Personio internships (03:30)
  cron.schedule('30 3 * * 0', () => {
    runWithAlert('Personio', 'personio', 'opportunities', importPersonioOpportunities);
  });

  // Weekly Tuesday: Arbeitnow aggregator (03:30)
  cron.schedule('30 3 * * 2', () => {
    runWithAlert('Arbeitnow', 'arbeitnow', 'opportunities', importArbeitnowOpportunities);
  });

  // Weekly Tuesday: RemoteOK (04:00)
  cron.schedule('0 4 * * 2', () => {
    runWithAlert('RemoteOK', 'remoteok', 'opportunities', importRemoteOKOpportunities);
  });

  // Monthly 1st: MUR universities (02:00) + courses (02:30)
  cron.schedule('0 2 1 * *', () => {
    runWithAlert('MUR Universities', 'mur', 'universities', importUniversities);
  });

  cron.schedule('30 2 1 * *', () => {
    runWithAlert('MUR Courses', 'mur', 'courses', importCourses);
  });

  // Quarterly: AlmaLaurea stats (1st Jan/Apr/Jul/Oct at 04:00)
  cron.schedule('0 4 1 1,4,7,10 *', () => {
    runWithAlert('AlmaLaurea', 'almalaurea', 'stats', importAlmaLaureaStats);
  });

  // Weekly Sunday: cleanup (05:00)
  cron.schedule('0 5 * * 0', async () => {
    logger.info('[Scheduler] Cleanup...');
    try {
      const r = await runCleanup();
      logger.info('[Scheduler] Cleanup done', { ...r });
    } catch (err) { logger.error(`[Scheduler] Cleanup failed: ${err}`); }
  });

  logger.info('[Scheduler] Import scheduler started:');
  logger.info('  EURES: disabled (static cache)');
  logger.info('  EU Youth: Mon 03:30 | SmartRecruiters: Mon 04:00');
  logger.info('  Arbeitnow: Tue 03:30 | RemoteOK: Tue 04:00');
  logger.info('  Stage4eu: Wed 03:30');
  logger.info('  Greenhouse: Thu 03:30 | Jobicy: Thu 04:00');
  logger.info('  Lever: Fri 03:30 | FashionUnited: Fri 04:00');
  logger.info('  Ashby: Sat 03:30 | Workable: Sat 04:00');
  logger.info('  Personio: Sun 03:30 | Cleanup: Sun 05:00');
  logger.info('  MUR: monthly 1st 02:00/02:30 | AlmaLaurea: quarterly');
}
