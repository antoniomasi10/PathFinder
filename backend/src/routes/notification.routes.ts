import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import * as notificationService from '../services/notification.service';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await notificationService.getNotifications(req.user!.userId, page, limit);
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

router.patch('/read-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
