import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

// Get conversations
router.get('/conversations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    // Get all users the current user has messages with
    const messages = await prisma.pathMatesMessage.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        groupId: null,
      },
      orderBy: { sentAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        receiver: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Group by conversation partner
    const convMap = new Map<string, any>();
    for (const msg of messages) {
      const partnerId = msg.senderId === userId ? msg.receiverId! : msg.senderId;
      if (!convMap.has(partnerId)) {
        const partner = msg.senderId === userId ? msg.receiver : msg.sender;
        convMap.set(partnerId, {
          user: partner,
          lastMessage: msg.content,
          lastMessageAt: msg.sentAt,
          unread: msg.receiverId === userId && !msg.readAt ? 1 : 0,
        });
      } else if (msg.receiverId === userId && !msg.readAt) {
        convMap.get(partnerId).unread++;
      }
    }

    res.json(Array.from(convMap.values()));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages with a specific user
router.get('/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const messages = await prisma.pathMatesMessage.findMany({
      where: {
        OR: [
          { senderId: req.user!.userId, receiverId: req.params.userId },
          { senderId: req.params.userId, receiverId: req.user!.userId },
        ],
        groupId: null,
      },
      orderBy: { sentAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Mark as read
    await prisma.pathMatesMessage.updateMany({
      where: {
        senderId: req.params.userId,
        receiverId: req.user!.userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get group messages
router.get('/group/:groupId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { groupId } = req.params;

    // Verify user is a member of the group
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) {
      return res.status(403).json({ error: 'Non sei membro di questo gruppo' });
    }

    const messages = await prisma.pathMatesMessage.findMany({
      where: { groupId },
      orderBy: { sentAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send a group message (REST fallback)
router.post('/group/:groupId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { groupId } = req.params;
    const { content } = req.body;

    // Verify user is a member of the group
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) {
      return res.status(403).json({ error: 'Non sei membro di questo gruppo' });
    }

    const message = await prisma.pathMatesMessage.create({
      data: {
        senderId: userId,
        groupId,
        content,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    res.status(201).json(message);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Send a message (REST fallback)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { receiverId, content } = req.body;
    const message = await prisma.pathMatesMessage.create({
      data: {
        senderId: req.user!.userId,
        receiverId,
        content,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });
    res.status(201).json(message);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
