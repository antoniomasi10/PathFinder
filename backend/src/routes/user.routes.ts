import { Router, Request, Response } from 'express';
import { verifiedMiddleware as authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { reportSchema } from '../schemas';
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
        avatarBgColor: true,
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

router.post('/:id/report', authMiddleware, validate(reportSchema), async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const reporterId = req.user!.userId;

    if (targetUserId === reporterId) {
      res.status(400).json({ error: 'Non puoi segnalare te stesso' });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!target) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }

    try {
      await prisma.userReport.create({ data: { targetUserId, reporterId, reason: req.body.reason } });
    } catch (err: any) {
      if (err.code === 'P2002') {
        res.status(400).json({ error: 'Hai già segnalato questo utente' });
        return;
      }
      throw err;
    }

    res.json({ message: 'Segnalazione inviata' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
