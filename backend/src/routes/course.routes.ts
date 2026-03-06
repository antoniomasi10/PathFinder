import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import { getComparison } from '../services/courseComparison.service';

const router = Router();

// GET /courses — list all courses
router.get('/', async (_req: Request, res: Response) => {
  try {
    const courses = await prisma.course.findMany({
      include: { university: { select: { id: true, name: true, city: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(courses);
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
      res.json({ saved: false });
    } else {
      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { savedCourses: { connect: { id: req.params.id } } },
      });
      res.json({ saved: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /courses/saved/list — get user's saved courses (authenticated)
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

export default router;
