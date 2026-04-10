/**
 * Import Alerting Service
 *
 * Notifies admin users when imports fail, so issues don't go unnoticed.
 */
import prisma from '../../lib/prisma';
import { createNotification } from '../notification.service';
import { logger } from '../../utils/logger';

/**
 * Alert all admin users about an import failure.
 */
export async function alertImportFailure(source: string, type: string, error: string) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (admins.length === 0) {
      logger.warn('[Alerting] No admin users to notify about import failure');
      return;
    }

    const message = `Import ${source}/${type} fallito: ${error.slice(0, 100)}`;

    for (const admin of admins) {
      await createNotification(
        admin.id,
        'SYSTEM',
        message,
        undefined,
        '\u{26A0}\u{FE0F}',
        { source, type, error: error.slice(0, 500) },
      );
    }

    logger.info(`[Alerting] Notified ${admins.length} admin(s) about ${source}/${type} failure`);
  } catch (err) {
    logger.error(`[Alerting] Failed to send import failure alerts: ${err}`);
  }
}

/**
 * Alert admins when data freshness is critically low.
 * Called during cleanup if stale data exceeds threshold.
 */
export async function alertStaleData(staleCount: number, source: string) {
  if (staleCount < 10) return; // Only alert if significant

  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    for (const admin of admins) {
      await createNotification(
        admin.id,
        'SYSTEM',
        `${staleCount} opportunità da ${source} non aggiornate da 60+ giorni`,
        undefined,
        '\u{1F4CA}',
        { staleCount, source },
      );
    }
  } catch (err) {
    logger.error(`[Alerting] Failed to send stale data alert: ${err}`);
  }
}
