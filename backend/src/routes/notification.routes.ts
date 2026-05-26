import { Router, Request, Response } from 'express';
import { verifiedMiddleware as authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import * as notificationService from '../services/notification.service';
import * as prefService from '../services/notificationPreference.service';
import * as brevoService from '../services/brevo.service';

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

// ── Push subscription (Brevo) ──────────────────────────────
router.post('/push/brevo-register', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { subscriberId } = req.body;
    if (!subscriberId || typeof subscriberId !== 'string') {
      return res.status(400).json({ error: 'subscriberId required' });
    }
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { brevoSubscriberId: subscriberId },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /push/test — send a test push to the authenticated user
router.post('/push/test', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!brevoService.isBrevoConfigured()) {
      return res.status(503).json({ success: false, error: 'Brevo non configurato sul server' });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { brevoSubscriberId: true },
    });
    if (!user?.brevoSubscriberId) {
      return res.status(409).json({
        success: false,
        error: 'Nessun device registrato. Attiva le notifiche da questo dispositivo prima di inviare un test.',
      });
    }
    await brevoService.sendPushToUser(req.user!.userId, {
      title: 'COhA',
      body: 'Le notifiche push funzionano correttamente!',
      url: '/notifications',
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /push/status — diagnostic snapshot of the user's push setup
router.get('/push/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { brevoSubscriberId: true },
    });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await prisma.notification.count({
      where: { userId: req.user!.userId, createdAt: { gte: since } },
    });
    const lastNotification = await prisma.notification.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, type: true },
    });
    res.json({
      brevoConfigured: brevoService.isBrevoConfigured(),
      brevoSubscriberId: user?.brevoSubscriberId ?? null,
      recentNotifications24h: recentCount,
      lastNotificationAt: lastNotification?.createdAt ?? null,
      lastNotificationType: lastNotification?.type ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /push/diagnostic-log — accept client-side push logs (mobile debugging)
router.post('/push/diagnostic-log', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { level, step, detail } = req.body || {};
    if (!step || typeof step !== 'string') {
      return res.status(400).json({ error: 'step required' });
    }
    const safeLevel = level === 'error' || level === 'warn' || level === 'info' ? level : 'info';
    const ua = String(req.headers['user-agent'] || '').slice(0, 200);
    // Log to backend logs so we can grep mobile issues by userId
    console[safeLevel === 'error' ? 'error' : 'warn'](
      '[push.diag]',
      JSON.stringify({ userId: req.user!.userId, level: safeLevel, step, detail, ua })
    );
    res.json({ ok: true });
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

router.delete('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.notification.deleteMany({ where: { userId: req.user!.userId } });
    res.json({ success: true });
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

    const updated = await notificationService.markAsRead(req.params.id, req.user!.userId);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
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
    await prisma.notification.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
