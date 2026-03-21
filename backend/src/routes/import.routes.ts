/**
 * Import Admin Routes
 *
 * Manual triggers for data imports + freshness stats.
 * All routes require auth.
 */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { importUniversities, importCourses } from '../services/import/mur.import';
import { importOpportunities } from '../services/import/eures.import';
import { runCleanup, getDataFreshnessStats } from '../services/import/cleanup.service';

const router = Router();

// GET /api/import/status — data freshness stats
router.get('/status', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const stats = await getDataFreshnessStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/mur/universities — trigger MUR university import
router.post('/mur/universities', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await importUniversities();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/mur/courses — trigger MUR course import
router.post('/mur/courses', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await importCourses();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/eures — trigger EURES opportunity import
router.post('/eures', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await importOpportunities();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/cleanup — trigger manual cleanup
router.post('/cleanup', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await runCleanup();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/all — run all imports + cleanup
router.post('/all', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const results = {
      universities: await importUniversities(),
      courses: await importCourses(),
      opportunities: await importOpportunities(),
      cleanup: await runCleanup(),
    };
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
