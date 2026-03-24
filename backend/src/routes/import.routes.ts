/**
 * Import Admin Routes — manual triggers + data freshness stats.
 */
import { Router, Request, Response } from 'express';
import { verifiedMiddleware as authMiddleware } from '../middleware/auth';
import { importUniversities, importCourses } from '../services/import/mur.import';
import { importOpportunities } from '../services/import/eures.import';
import { importEUOpportunities } from '../services/import/eu-youth.import';
import { importAlmaLaureaStats } from '../services/import/almalaurea.import';
import { runCleanup, getDataFreshnessStats } from '../services/import/cleanup.service';

const router = Router();

// GET /api/import/status
router.get('/status', authMiddleware, async (_req: Request, res: Response) => {
  try { res.json(await getDataFreshnessStats()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/mur/universities
router.post('/mur/universities', authMiddleware, async (_req: Request, res: Response) => {
  try { res.json(await importUniversities()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/mur/courses
router.post('/mur/courses', authMiddleware, async (_req: Request, res: Response) => {
  try { res.json(await importCourses()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/eures
router.post('/eures', authMiddleware, async (_req: Request, res: Response) => {
  try { res.json(await importOpportunities()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/eu-youth
router.post('/eu-youth', authMiddleware, async (_req: Request, res: Response) => {
  try { res.json(await importEUOpportunities()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/almalaurea
router.post('/almalaurea', authMiddleware, async (_req: Request, res: Response) => {
  try { res.json(await importAlmaLaureaStats()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/cleanup
router.post('/cleanup', authMiddleware, async (_req: Request, res: Response) => {
  try { res.json(await runCleanup()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/all — run everything
router.post('/all', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const results = {
      universities: await importUniversities(),
      courses: await importCourses(),
      eures: await importOpportunities(),
      euYouth: await importEUOpportunities(),
      almalaurea: await importAlmaLaureaStats(),
      cleanup: await runCleanup(),
    };
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
