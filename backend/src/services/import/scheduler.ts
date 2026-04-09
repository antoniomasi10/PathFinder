/**
 * Import Scheduler
 *
 * Cron schedules:
 * - EURES opportunities: daily at 03:00
 * - EU Youth/Eurodesk: weekly Monday 03:30
 * - MUR universities: 1st of each month at 02:00
 * - MUR courses: 1st of each month at 02:30
 * - AlmaLaurea stats: quarterly (1st Jan, Apr, Jul, Oct at 04:00)
 * - Cleanup stale data: weekly Sunday at 05:00
 */
import cron from 'node-cron';
import { importUniversities, importCourses } from './mur.import';
import { importOpportunities } from './eures.import';
import { importEUOpportunities } from './eu-youth.import';
import { importStage4euOpportunities } from './stage4eu.import';
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
  // Daily: EURES opportunities (03:00)
  cron.schedule('0 3 * * *', () => {
    runWithAlert('EURES', 'eures', 'opportunities', importOpportunities);
  });

  // Weekly Monday: EU Youth + Eurodesk (03:30)
  cron.schedule('30 3 * * 1', () => {
    runWithAlert('EU Youth', 'eu-youth', 'opportunities', importEUOpportunities);
  });

  // Weekly Wednesday: Stage4eu (03:30)
  cron.schedule('30 3 * * 3', () => {
    runWithAlert('Stage4eu', 'stage4eu', 'opportunities', importStage4euOpportunities);
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
  logger.info('  EURES: daily 03:00 | EU Youth: weekly Mon 03:30 | Stage4eu: weekly Wed 03:30');
  logger.info('  MUR: monthly 1st 02:00/02:30 | AlmaLaurea: quarterly');
  logger.info('  Cleanup: weekly Sun 05:00');
}
