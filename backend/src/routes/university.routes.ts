import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const universities = await prisma.university.findMany({
      include: {
        _count: { select: { opportunities: true, users: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(universities);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const university = await prisma.university.findUnique({
      where: { id: req.params.id },
      include: {
        courses: true,
        opportunities: { take: 10, orderBy: { postedAt: 'desc' } },
        _count: { select: { opportunities: true, users: true } },
      },
    });
    if (!university) {
      res.status(404).json({ error: 'Università non trovata' });
      return;
    }
    res.json(university);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
