import { Router, Request, Response } from 'express';
import { verifiedMiddleware as authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import { cacheGet, cacheSet } from '../lib/cache';

const UNIVERSITY_TTL = 60 * 60; // 1 hour — university data rarely changes

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'cache:universities:all';
    const cached = await cacheGet(cacheKey);
    if (cached) { res.json(cached); return; }

    const universities = await prisma.university.findMany({
      include: {
        _count: { select: { opportunities: true, users: true } },
      },
      orderBy: { name: 'asc' },
    });
    await cacheSet(cacheKey, universities, UNIVERSITY_TTL);
    res.json(universities);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const cacheKey = `cache:university:${req.params.id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) { res.json(cached); return; }

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
    await cacheSet(cacheKey, university, UNIVERSITY_TTL);
    res.json(university);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
