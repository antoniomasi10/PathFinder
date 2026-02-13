import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
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
router.post('/request', authMiddleware, async (req: Request, res: Response) => {
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

    const request = await prisma.friendRequest.create({
      data: { fromUserId: req.user!.userId, toUserId },
    });

    await createNotification(toUserId, 'FRIEND_REQUEST', 'Hai ricevuto una nuova richiesta di connessione', `/profile/${req.user!.userId}`);

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
      await createNotification(request.fromUserId, 'FRIEND_ACCEPTED', 'La tua richiesta di connessione è stata accettata!', `/profile/${req.user!.userId}`);
    }

    res.json(request);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
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
    res.json({ status: request?.status || null, requestId: request?.id || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
