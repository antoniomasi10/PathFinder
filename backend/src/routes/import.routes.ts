/**
 * Import Admin Routes — manual triggers + data freshness stats.
 * All endpoints require ADMIN role.
 */
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
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
import { importConfsTechOpportunities } from '../services/import/confstech.import';
import { runCleanup, getDataFreshnessStats } from '../services/import/cleanup.service';
import { upsertManualOpportunity } from '../services/import/manual.import';
import {
  importCompanyWatchlistOpportunities,
  importSingleCompany,
  checkRobotsTxt,
  findAndAnalyzeTos,
} from '../services/import/company-watchlist.import';
import { resetDedupCache } from '../services/import/validation';

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

// POST /api/import/confstech
router.post('/confstech', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await importConfsTechOpportunities()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/manual — upsert a single curated opportunity (verified=true)
router.post('/manual', ...adminAuth, async (req: Request, res: Response) => {
  try { res.json(await upsertManualOpportunity(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});

// GET /api/import/watchlist — list companies with compliance status
router.get('/watchlist', ...adminAuth, async (req: Request, res: Response) => {
  try {
        const { sector, tier, tosAllowed, isActive } = req.query;
    const where: any = {};
    if (sector) where.sector = sector;
    if (tier) where.tier = tier;
    if (tosAllowed !== undefined) where.tosAllowed = tosAllowed === 'true' ? true : tosAllowed === 'false' ? false : null;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    const companies = await prisma.companyWatchlist.findMany({
      where,
      orderBy: [{ sector: 'asc' }, { tier: 'asc' }, { name: 'asc' }],
    });
    res.json(companies);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/watchlist — add company and trigger robots+ToS check
router.post('/watchlist', ...adminAuth, async (req: Request, res: Response) => {
  try {
        const { name, careersUrl, sector, tier } = req.body;
    if (!name || !careersUrl || !sector || !tier) {
      return res.status(400).json({ error: 'name, careersUrl, sector, tier are required' });
    }
    const now = new Date();
    const [robotsAllowed, tosResult] = await Promise.all([
      checkRobotsTxt(careersUrl),
      findAndAnalyzeTos(careersUrl),
    ]);
    const company = await prisma.companyWatchlist.create({
      data: {
        name,
        careersUrl,
        sector,
        tier,
        robotsAllowed,
        robotsCheckedAt: now,
        tosAllowed: tosResult.allowed,
        tosAnalyzedAt: now,
        tosNotes: tosResult.notes,
        tosPageNotFound: tosResult.pageNotFound,
        addedBy: (req as any).user?.id,
      },
    });
    res.json(company);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// PATCH /api/import/watchlist/:id — update company (manual override)
router.patch('/watchlist/:id', ...adminAuth, async (req: Request, res: Response) => {
  try {
        const { tosAllowed, isActive, robotsAllowed } = req.body;
    const data: any = {};
    if (typeof tosAllowed === 'boolean') data.tosAllowed = tosAllowed;
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (typeof robotsAllowed === 'boolean') data.robotsAllowed = robotsAllowed;
    const company = await prisma.companyWatchlist.update({
      where: { id: req.params.id },
      data,
    });
    res.json(company);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/import/watchlist/:id — remove company
router.delete('/watchlist/:id', ...adminAuth, async (req: Request, res: Response) => {
  try {
        await prisma.companyWatchlist.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// POST /api/import/watchlist/run — trigger full watchlist import
// Must be registered BEFORE /:id/run to avoid Express treating "run" as an id.
router.post('/watchlist/run', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await importCompanyWatchlistOpportunities()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/watchlist/:id/run — trigger single company import
router.post('/watchlist/:id/run', ...adminAuth, async (req: Request, res: Response) => {
  try {
    const result = await importSingleCompany(req.params.id);
    res.json(result);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// POST /api/import/cleanup
router.post('/cleanup', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await runCleanup()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/all — run everything
router.post('/all', ...adminAuth, async (_req: Request, res: Response) => {
  try {
    resetDedupCache(); const universities = await importUniversities();
    resetDedupCache(); const courses = await importCourses();
    resetDedupCache(); const eures = await importOpportunities();
    resetDedupCache(); const euYouth = await importEUOpportunities();
    resetDedupCache(); const almalaurea = await importAlmaLaureaStats();
    const cleanup = await runCleanup();
    res.json({ universities, courses, eures, euYouth, almalaurea, cleanup });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
