import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import * as notificationService from '../services/notification.service';
import * as prefService from '../services/notificationPreference.service';
import * as webPushService from '../services/webPush.service';

const router = Router();

// ── Preferences ────────────────────────────────────────────
router.get('/preferences', authMiddleware, async (req: Request, res: Response) => {
  try {
    const prefs = await prefService.getOrCreatePreferences(req.user!.userId);
    res.json(prefs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/preferences', authMiddleware, async (req: Request, res: Response) => {
  try {
    const prefs = await prefService.updatePreferences(req.user!.userId, req.body);
    res.json(prefs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Push subscription ──────────────────────────────────────
router.get('/push/vapid-key', (_req: Request, res: Response) => {
  res.json({ publicKey: webPushService.getVapidPublicKey() });
});

router.post('/push/subscribe', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }
    await webPushService.saveSubscription(
      req.user!.userId,
      subscription,
      req.headers['user-agent']
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/push/unsubscribe', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    await webPushService.removeSubscription(endpoint);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /push/test — send a test push to the authenticated user
router.post('/push/test', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await webPushService.sendPushToUser(req.user!.userId, {
      body: 'Le notifiche push funzionano correttamente!',
      type: 'GENERAL',
      url: '/notifications',
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Notifications ──────────────────────────────────────────
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const filter = req.query.filter as string | undefined;
    const result = await notificationService.getNotifications(req.user!.userId, page, limit, filter);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/unread-count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.userId);
    res.json({ count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/badge-counts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const counts = await notificationService.getBadgeCounts(req.user!.userId);
    res.json(counts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/read-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    await notificationService.markAllAsRead(req.user!.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      res.status(404).json({ error: 'Notifica non trovata' });
      return;
    }

    if (notification.userId !== req.user!.userId) {
      res.status(403).json({ error: 'Non autorizzato' });
      return;
    }

    const updated = await notificationService.markAsRead(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/badge-unlocked', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { badgeName, badgeIcon } = req.body;
    if (!badgeName) {
      return res.status(400).json({ error: 'badgeName is required' });
    }
    const notification = await notificationService.createNotification(
      req.user!.userId,
      'BADGE_UNLOCKED',
      `Hai sbloccato il badge "${badgeName}"!`,
      '/profile',
      badgeIcon || '\u{1F3C6}',
      { badgeName }
    );
    res.json(notification);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
