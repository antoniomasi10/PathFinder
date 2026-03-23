import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendMessageSchema } from '../schemas';
import prisma from '../lib/prisma';
import { validateImages } from '../utils/imageValidation';

const router = Router();

// Get conversations with pagination
router.get('/conversations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    // Get all users the current user has messages with
    const messages = await prisma.pathMatesMessage.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        groupId: null,
      },
      orderBy: { sentAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
        receiver: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
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
          lastMessage: msg.images && msg.images.length > 0 && !msg.content ? '📷 Foto' : msg.content,
          lastMessageAt: msg.sentAt,
          unread: msg.receiverId === userId && !msg.readAt ? 1 : 0,
        });
      } else if (msg.receiverId === userId && !msg.readAt) {
        convMap.get(partnerId).unread++;
      }
    }

    const allConversations = Array.from(convMap.values());
    const total = allConversations.length;
    const skip = (page - 1) * limit;
    const paginated = allConversations.slice(skip, skip + limit);

    res.json({ data: paginated, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages with a specific user
router.get('/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    // Messages are already filtered by current user, but validate the userId param
    if (req.params.userId === currentUserId) {
      res.status(400).json({ error: 'Non puoi visualizzare conversazioni con te stesso' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const where = {
      OR: [
        { senderId: req.user!.userId, receiverId: req.params.userId },
        { senderId: req.params.userId, receiverId: req.user!.userId },
      ],
      groupId: null,
    };

    const [messages, total] = await Promise.all([
      prisma.pathMatesMessage.findMany({
        where,
        orderBy: { sentAt: 'asc' },
        take: limit,
        skip,
        include: {
          sender: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
        },
      }),
      prisma.pathMatesMessage.count({ where }),
    ]);

    // Mark as read
    await prisma.pathMatesMessage.updateMany({
      where: {
        senderId: req.params.userId,
        receiverId: req.user!.userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    res.json({ data: messages, total, page, totalPages: Math.ceil(total / limit) });
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
        sender: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
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
    const { content, images } = req.body;

    // Verify user is a member of the group
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) {
      return res.status(403).json({ error: 'Non sei membro di questo gruppo' });
    }

    const validImages = validateImages(images);
    const message = await prisma.pathMatesMessage.create({
      data: {
        senderId: userId,
        groupId,
        content,
        images: validImages,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
      },
    });

    res.status(201).json(message);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Send a message (REST fallback)
router.post('/', authMiddleware, validate(sendMessageSchema), async (req: Request, res: Response) => {
  try {
    const { receiverId, content, images } = req.body;

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      res.status(404).json({ error: 'Destinatario non trovato' });
      return;
    }

    const friendship = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: req.user!.userId, toUserId: receiverId, status: 'ACCEPTED' },
          { fromUserId: receiverId, toUserId: req.user!.userId, status: 'ACCEPTED' },
        ],
      },
    });
    if (!friendship) {
      res.status(403).json({ error: 'Puoi messaggiare solo i tuoi amici' });
      return;
    }

    const validImages = validateImages(images);
    const message = await prisma.pathMatesMessage.create({
      data: {
        senderId: req.user!.userId,
        receiverId,
        content,
        images: validImages,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
      },
    });
    res.status(201).json(message);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
