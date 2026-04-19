/**
 * Import Admin Routes — manual triggers + data freshness stats.
 * All endpoints require ADMIN role.
 */
import { Router, Request, Response } from 'express';
import { verifiedMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { importUniversities, importCourses } from '../services/import/mur.import';
import { importOpportunities } from '../services/import/eures.import';
import { importEUOpportunities } from '../services/import/eu-youth.import';
import { importAlmaLaureaStats } from '../services/import/almalaurea.import';
import { importOpportunityDeskOpportunities } from '../services/import/opportunity-desk.import';
import { importHackClubOpportunities } from '../services/import/hackclub.import';
import { importDevpostOpportunities } from '../services/import/devpost.import';
import { importBestCoursesOpportunities } from '../services/import/best-courses.import';
import { runCleanup, getDataFreshnessStats } from '../services/import/cleanup.service';
import { upsertManualOpportunity } from '../services/import/manual.import';

const router = Router();

// All import routes require verified auth + admin role
const adminAuth = [verifiedMiddleware, adminMiddleware];

// GET /api/import/status
router.get('/status', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await getDataFreshnessStats()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/mur/universities
router.post('/mur/universities', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await importUniversities()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/mur/courses
router.post('/mur/courses', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await importCourses()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/eures
router.post('/eures', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await importOpportunities()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/eu-youth
router.post('/eu-youth', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await importEUOpportunities()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/almalaurea
router.post('/almalaurea', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await importAlmaLaureaStats()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/opportunity-desk
router.post('/opportunity-desk', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await importOpportunityDeskOpportunities()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/hackclub
router.post('/hackclub', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await importHackClubOpportunities()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Devpost: DISABLED — ToS prohibits automated access. Obtain permission before re-enabling.

// BEST Courses: DISABLED — contact info@best.eu.org for data usage permission before re-enabling.

// POST /api/import/manual — upsert a single curated opportunity (verified=true)
router.post('/manual', ...adminAuth, async (req: Request, res: Response) => {
  try { res.json(await upsertManualOpportunity(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});

// POST /api/import/cleanup
router.post('/cleanup', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await runCleanup()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/all — run everything
router.post('/all', ...adminAuth, async (_req: Request, res: Response) => {
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
