import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { friendRequestSchema, batchStatusSchema } from '../schemas';
import prisma from '../lib/prisma';
import { createNotification } from '../services/notification.service';

const router = Router();

// Get friends list
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const friends = await prisma.friendRequest.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { fromUserId: req.user!.userId },
          { toUserId: req.user!.userId },
        ],
      },
      include: {
        fromUser: { select: { id: true, name: true, avatar: true, courseOfStudy: true, university: { select: { name: true } } } },
        toUser: { select: { id: true, name: true, avatar: true, courseOfStudy: true, university: { select: { name: true } } } },
      },
    });

    const friendUsers = friends.map((f) => {
      return f.fromUserId === req.user!.userId ? f.toUser : f.fromUser;
    });

    res.json(friendUsers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get pending requests
router.get('/requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const requests = await prisma.friendRequest.findMany({
      where: { toUserId: req.user!.userId, status: 'PENDING' },
      include: {
        fromUser: { select: { id: true, name: true, avatar: true, courseOfStudy: true, university: { select: { name: true } } } },
      },
    });
    res.json(requests);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send friend request
router.post('/request', authMiddleware, validate(friendRequestSchema), async (req: Request, res: Response) => {
  try {
    const { toUserId } = req.body;
    if (toUserId === req.user!.userId) {
      res.status(400).json({ error: 'Non puoi inviare una richiesta a te stesso' });
      return;
    }

    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: req.user!.userId, toUserId },
          { fromUserId: toUserId, toUserId: req.user!.userId },
        ],
      },
    });

    if (existing) {
      res.status(400).json({ error: 'Richiesta già esistente' });
      return;
    }

    const fromUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { name: true },
    });

    const request = await prisma.friendRequest.create({
      data: { fromUserId: req.user!.userId, toUserId, status: 'PENDING' },
    });

    await createNotification(
      toUserId,
      'FRIEND_REQUEST',
      `${fromUser?.name || 'Qualcuno'} ti ha inviato una richiesta di amicizia`,
      `/profile/${req.user!.userId}`,
      '\u{1F465}',
      { fromUserId: req.user!.userId }
    );

    res.status(201).json(request);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Accept/reject friend request
router.patch('/request/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['ACCEPTED', 'REJECTED'].includes(status)) {
      res.status(400).json({ error: 'Stato non valido' });
      return;
    }

    const request = await prisma.friendRequest.update({
      where: { id: req.params.id, toUserId: req.user!.userId },
      data: { status },
    });

    if (status === 'ACCEPTED') {
      const acceptor = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { name: true },
      });
      await createNotification(
        request.fromUserId,
        'FRIEND_ACCEPTED',
        `${acceptor?.name || 'Qualcuno'} ha accettato la tua richiesta di connessione`,
        `/profile/${req.user!.userId}`,
        '\u{1F91D}',
        { fromUserId: req.user!.userId }
      );
    }

    res.json(request);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get suggested pathmates (users who are not friends and have no pending request)
router.get('/suggestions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const existingRelations = await prisma.friendRequest.findMany({
      where: {
        OR: [
          { fromUserId: req.user!.userId },
          { toUserId: req.user!.userId },
        ],
      },
      select: { fromUserId: true, toUserId: true },
    });

    const excludeIds = new Set<string>([req.user!.userId]);
    existingRelations.forEach((r) => {
      excludeIds.add(r.fromUserId);
      excludeIds.add(r.toUserId);
    });

    const suggestions = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(excludeIds) },
        profileCompleted: true,
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        courseOfStudy: true,
        university: { select: { name: true } },
      },
      take: 10,
    });

    res.json(suggestions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Remove friend
router.delete('/:friendId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const deleted = await prisma.friendRequest.deleteMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { fromUserId: req.user!.userId, toUserId: req.params.friendId },
          { fromUserId: req.params.friendId, toUserId: req.user!.userId },
        ],
      },
    });

    if (deleted.count === 0) {
      res.status(404).json({ error: 'Amicizia non trovata' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Check friendship status
router.get('/status/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const request = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: req.user!.userId, toUserId: req.params.userId },
          { fromUserId: req.params.userId, toUserId: req.user!.userId },
        ],
      },
    });
    res.json({ status: request?.status || null, requestId: request?.id || null, fromUserId: request?.fromUserId || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Batch check friendship status for multiple users
router.post('/status/batch', authMiddleware, validate(batchStatusSchema), async (req: Request, res: Response) => {
  try {
    const { userIds } = req.body;

    const requests = await prisma.friendRequest.findMany({
      where: {
        OR: [
          { fromUserId: req.user!.userId, toUserId: { in: userIds } },
          { fromUserId: { in: userIds }, toUserId: req.user!.userId },
        ],
      },
    });

    const statusMap: Record<string, { status: string; requestId: string; fromUserId: string }> = {};
    for (const r of requests) {
      const otherUserId = r.fromUserId === req.user!.userId ? r.toUserId : r.fromUserId;
      statusMap[otherUserId] = { status: r.status, requestId: r.id, fromUserId: r.fromUserId };
    }

    res.json(statusMap);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
