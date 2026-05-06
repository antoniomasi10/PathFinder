import { Router, Request, Response } from 'express';
import { verifiedMiddleware as authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { friendRequestSchema, batchStatusSchema } from '../schemas';
import prisma from '../lib/prisma';
import { createNotification } from '../services/notification.service';
import { trackInteraction } from '../services/interaction.service';
import { getSmartFriendSuggestions } from '../services/similarity.service';
import { cacheGet, cacheSet, cacheDel } from '../lib/cache';

const FRIENDS_TTL = 2 * 60;       // 2 minutes
const SUGGESTIONS_TTL = 10 * 60;  // 10 minutes

function invalidateFriendsCache(...userIds: string[]) {
  return Promise.all(
    userIds.flatMap((id) => [
      cacheDel(`cache:friends:${id}`),
      cacheDel(`cache:friend-suggestions:${id}`),
    ])
  ).catch(() => {});
}

const router = Router();

// Get friends list
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const cacheKey = `cache:friends:${req.user!.userId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) { res.json(cached); return; }

    const friends = await prisma.friendRequest.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { fromUserId: req.user!.userId },
          { toUserId: req.user!.userId },
        ],
      },
      include: {
        fromUser: { select: { id: true, name: true, avatar: true, avatarBgColor: true, courseOfStudy: true, university: { select: { name: true } } } },
        toUser: { select: { id: true, name: true, avatar: true, avatarBgColor: true, courseOfStudy: true, university: { select: { name: true } } } },
      },
    });

    const friendUsers = friends.map((f) => {
      return f.fromUserId === req.user!.userId ? f.toUser : f.fromUser;
    });

    await cacheSet(cacheKey, friendUsers, FRIENDS_TTL);
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
        fromUser: { select: { id: true, name: true, avatar: true, avatarBgColor: true, courseOfStudy: true, university: { select: { name: true } } } },
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

    // Use transaction to prevent race conditions (check-then-create atomicity)
    const result = await prisma.$transaction(async (tx) => {
      // Delete old rejected requests so a new one can be sent
      await tx.friendRequest.deleteMany({
        where: {
          OR: [
            { fromUserId: req.user!.userId, toUserId },
            { fromUserId: toUserId, toUserId: req.user!.userId },
          ],
          status: 'REJECTED',
        },
      });

      const existing = await tx.friendRequest.findFirst({
        where: {
          OR: [
            { fromUserId: req.user!.userId, toUserId },
            { fromUserId: toUserId, toUserId: req.user!.userId },
          ],
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
      });

      if (existing) {
        return { error: existing.status === 'ACCEPTED' ? 'Siete già connessi' : 'Richiesta già inviata' };
      }

      const request = await tx.friendRequest.create({
        data: { fromUserId: req.user!.userId, toUserId, status: 'PENDING' },
      });

      return { request };
    });

    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    const { request } = result;

    const fromUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { name: true },
    });

    trackInteraction(req.user!.userId, 'user', toUserId, 'friend_request').catch(() => {});

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
      // Both users' friend lists changed
      invalidateFriendsCache(req.user!.userId, request.fromUserId);
    }

    res.json(request);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get suggested pathmates (smart scoring: profile similarity, university, mutual friends, shared saves)
router.get('/suggestions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const cacheKey = `cache:friend-suggestions:${req.user!.userId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) { res.json(cached); return; }

    const suggestions = await getSmartFriendSuggestions(req.user!.userId, 10);
    await cacheSet(cacheKey, suggestions, SUGGESTIONS_TTL);
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

    invalidateFriendsCache(req.user!.userId, req.params.friendId);
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
    // Only expose direction relative to the current user (not raw fromUserId)
    let direction: 'sent' | 'received' | null = null;
    if (request) {
      direction = request.fromUserId === req.user!.userId ? 'sent' : 'received';
    }
    res.json({ status: request?.status || null, requestId: request?.id || null, direction });
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

    const statusMap: Record<string, { status: string; requestId: string; direction: 'sent' | 'received' }> = {};
    for (const r of requests) {
      const otherUserId = r.fromUserId === req.user!.userId ? r.toUserId : r.fromUserId;
      const direction = r.fromUserId === req.user!.userId ? 'sent' : 'received';
      statusMap[otherUserId] = { status: r.status, requestId: r.id, direction };
    }

    res.json(statusMap);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
