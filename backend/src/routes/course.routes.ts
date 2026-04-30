import { Router, Request, Response } from 'express';
import { verifiedMiddleware as authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import { getComparison } from '../services/courseComparison.service';
import { trackInteraction } from '../services/interaction.service';

const router = Router();

// GET /courses — list courses with optional search and filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string || '').trim();
    const field = (req.query.field as string || '').trim();
    const type = (req.query.type as string || '').trim();
    const university = (req.query.university as string || '').trim();
    const city = (req.query.city as string || '').trim();
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { field: { contains: search, mode: 'insensitive' } },
        { university: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (field) where.field = { contains: field, mode: 'insensitive' };
    if (type) where.type = type;
    if (university) where.university = { name: { contains: university, mode: 'insensitive' } };
    if (city) where.university = { ...where.university, city: { contains: city, mode: 'insensitive' } };

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: { university: { select: { id: true, name: true, city: true } } },
        orderBy: { name: 'asc' },
        take: limit,
        skip,
      }),
      prisma.course.count({ where }),
    ]);

    res.json({ data: courses, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /courses/saved/list — get user's saved courses (authenticated)
// MUST be before /:id to avoid matching "saved" as an id
router.get('/saved/list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        savedCourses: {
          include: { university: { select: { id: true, name: true, city: true } } },
        },
      },
    });
    res.json(user?.savedCourses || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /courses/:id — single course detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: { university: true },
    });
    if (!course) {
      res.status(404).json({ error: 'Corso non trovato' });
      return;
    }
    res.json(course);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /courses/:id/compare — course comparison (authenticated)
router.get('/:id/compare', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await getComparison(req.params.id, req.user!.userId);
    trackInteraction(req.user!.userId, 'course', req.params.id, 'view').catch(() => {});
    res.json(result);
  } catch (err: any) {
    if (err.message === 'Corso non trovato') {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /courses/:id/save — toggle save course (authenticated)
router.post('/:id/save', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { savedCourses: { where: { id: req.params.id } } },
    });

    if (user?.savedCourses.length) {
      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { savedCourses: { disconnect: { id: req.params.id } } },
      });
      trackInteraction(req.user!.userId, 'course', req.params.id, 'unsave').catch(() => {});
      res.json({ saved: false });
    } else {
      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { savedCourses: { connect: { id: req.params.id } } },
      });
      trackInteraction(req.user!.userId, 'course', req.params.id, 'save').catch(() => {});
      res.json({ saved: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
