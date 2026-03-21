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
import { importAlmaLaureaStats } from './almalaurea.import';
import { runCleanup } from './cleanup.service';
import { logger } from '../../utils/logger';

export function startImportScheduler() {
  // Daily: EURES opportunities (03:00)
  cron.schedule('0 3 * * *', async () => {
    logger.info('[Scheduler] EURES import...');
    try {
      const r = await importOpportunities();
      logger.info(`[Scheduler] EURES: ${r.imported} (${r.source})`);
    } catch (err) { logger.error(`[Scheduler] EURES failed: ${err}`); }
  });

  // Weekly Monday: EU Youth + Eurodesk (03:30)
  cron.schedule('30 3 * * 1', async () => {
    logger.info('[Scheduler] EU Youth import...');
    try {
      const r = await importEUOpportunities();
      logger.info(`[Scheduler] EU Youth: ${r.imported} from ${r.sources.join(', ')}`);
    } catch (err) { logger.error(`[Scheduler] EU Youth failed: ${err}`); }
  });

  // Monthly 1st: MUR universities (02:00) + courses (02:30)
  cron.schedule('0 2 1 * *', async () => {
    logger.info('[Scheduler] MUR university import...');
    try {
      const r = await importUniversities();
      logger.info(`[Scheduler] MUR unis: ${r.imported} (${r.source})`);
    } catch (err) { logger.error(`[Scheduler] MUR unis failed: ${err}`); }
  });

  cron.schedule('30 2 1 * *', async () => {
    logger.info('[Scheduler] MUR course import...');
    try {
      const r = await importCourses();
      logger.info(`[Scheduler] MUR courses: ${r.imported} (${r.source})`);
    } catch (err) { logger.error(`[Scheduler] MUR courses failed: ${err}`); }
  });

  // Quarterly: AlmaLaurea stats (1st Jan/Apr/Jul/Oct at 04:00)
  cron.schedule('0 4 1 1,4,7,10 *', async () => {
    logger.info('[Scheduler] AlmaLaurea stats import...');
    try {
      const r = await importAlmaLaureaStats();
      logger.info(`[Scheduler] AlmaLaurea: ${r.updated} courses updated (${r.source})`);
    } catch (err) { logger.error(`[Scheduler] AlmaLaurea failed: ${err}`); }
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
  logger.info('  EURES: daily 03:00 | EU Youth: weekly Mon 03:30');
  logger.info('  MUR: monthly 1st 02:00/02:30 | AlmaLaurea: quarterly');
  logger.info('  Cleanup: weekly Sun 05:00');
}
