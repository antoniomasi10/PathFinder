import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

// Search users
router.get('/search', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const q = (req.query.q as string) || '';

    const where: any = {
      id: { not: userId },
      profileCompleted: true,
    };

    if (q.trim()) {
      where.name = { contains: q.trim(), mode: 'insensitive' };
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        avatar: true,
        courseOfStudy: true,
        university: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
      take: 50,
    });

    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
