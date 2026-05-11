import cron from 'node-cron';
import { logger } from '../utils/logger';
import { runWeeklyDigest, runExpiringAlert } from './emailCampaigns.service';

export function startCampaignScheduler(): void {
  // Weekly digest: every Monday at 09:00 Rome time
  cron.schedule(
    '0 9 * * 1',
    async () => {
      logger.info('Campaign: starting weekly digest');
      try {
        await runWeeklyDigest();
      } catch (err) {
        logger.error('Campaign: weekly digest error', { error: String(err) });
      }
    },
    { timezone: 'Europe/Rome' }
  );

  // Expiring alert: every day at 08:00 Rome time
  cron.schedule(
    '0 8 * * *',
    async () => {
      logger.info('Campaign: starting expiring opportunities alert');
      try {
        await runExpiringAlert();
      } catch (err) {
        logger.error('Campaign: expiring alert error', { error: String(err) });
      }
    },
    { timezone: 'Europe/Rome' }
  );

  logger.info('Campaign scheduler started (weekly digest Mon 09:00, expiring alert daily 08:00 Europe/Rome)');
}
