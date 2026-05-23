import cron from 'node-cron';
import { logger } from '../utils/logger';
import { runWeeklyDigest, runExpiringAlert, runDailyOpportunity, runSpotRecommendation } from './emailCampaigns.service';

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

  // Daily opportunity: every day at 07:30 Rome time
  cron.schedule(
    '30 7 * * *',
    async () => {
      logger.info('Campaign: starting daily opportunity');
      try {
        await runDailyOpportunity();
      } catch (err) {
        logger.error('Campaign: daily opportunity error', { error: String(err) });
      }
    },
    { timezone: 'Europe/Rome' }
  );

  // Spot recommendation: every day at 10:00 Rome time
  cron.schedule(
    '0 10 * * *',
    async () => {
      logger.info('Campaign: starting spot recommendation');
      try {
        await runSpotRecommendation();
      } catch (err) {
        logger.error('Campaign: spot recommendation error', { error: String(err) });
      }
    },
    { timezone: 'Europe/Rome' }
  );

  logger.info('Campaign scheduler started (daily opp 07:30, expiring alert 08:00, weekly digest Mon 09:00, spot rec 10:00 Europe/Rome)');
}
