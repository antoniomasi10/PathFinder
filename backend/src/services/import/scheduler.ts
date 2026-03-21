/**
 * Import Scheduler
 *
 * Cron schedules:
 * - EURES opportunities: daily at 03:00
 * - MUR universities: 1st of each month at 02:00
 * - MUR courses: 1st of each month at 02:30
 * - Cleanup stale data: weekly Sunday at 04:00
 */
import cron from 'node-cron';
import { importUniversities, importCourses } from './mur.import';
import { importOpportunities } from './eures.import';
import { runCleanup } from './cleanup.service';
import { logger } from '../../utils/logger';

export function startImportScheduler() {
  // Daily: EURES opportunities (03:00)
  cron.schedule('0 3 * * *', async () => {
    logger.info('[Scheduler] Running daily EURES import...');
    try {
      const result = await importOpportunities();
      logger.info(`[Scheduler] EURES done: ${result.imported} imported (${result.source})`);
    } catch (err) {
      logger.error(`[Scheduler] EURES failed: ${err}`);
    }
  });

  // Monthly: MUR universities (1st at 02:00)
  cron.schedule('0 2 1 * *', async () => {
    logger.info('[Scheduler] Running monthly MUR university import...');
    try {
      const result = await importUniversities();
      logger.info(`[Scheduler] MUR unis done: ${result.imported} (${result.source})`);
    } catch (err) {
      logger.error(`[Scheduler] MUR unis failed: ${err}`);
    }
  });

  // Monthly: MUR courses (1st at 02:30)
  cron.schedule('30 2 1 * *', async () => {
    logger.info('[Scheduler] Running monthly MUR course import...');
    try {
      const result = await importCourses();
      logger.info(`[Scheduler] MUR courses done: ${result.imported} (${result.source})`);
    } catch (err) {
      logger.error(`[Scheduler] MUR courses failed: ${err}`);
    }
  });

  // Weekly: cleanup stale data (Sunday 04:00)
  cron.schedule('0 4 * * 0', async () => {
    logger.info('[Scheduler] Running weekly cleanup...');
    try {
      const result = await runCleanup();
      logger.info('[Scheduler] Cleanup done', { ...result });
    } catch (err) {
      logger.error(`[Scheduler] Cleanup failed: ${err}`);
    }
  });

  logger.info('[Scheduler] Import scheduler started');
  logger.info('  - EURES: daily 03:00');
  logger.info('  - MUR universities: monthly 1st 02:00');
  logger.info('  - MUR courses: monthly 1st 02:30');
  logger.info('  - Cleanup: weekly Sunday 04:00');
}
