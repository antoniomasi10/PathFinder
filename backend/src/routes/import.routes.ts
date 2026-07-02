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
import { runCleanup } from '../services/import/cleanup.service';
import { upsertManualOpportunity } from '../services/import/manual.import';
import {
  importCompanyWatchlistOpportunities,
  importSingleCompany,
} from '../services/import/company-watchlist.import';
import { importANPALOpportunities } from '../services/import/anpal.import';
import { importF6sOpportunities } from '../services/import/f6s.import';
import { checkRobotsTxt, findAndAnalyzeTos } from '../services/import/compliance';
import { resetDedupCache } from '../services/import/validation';
import { runAtsConnector } from '../services/import/ats/ats-connector';
import { ATS_ADAPTER_BY_PLATFORM } from '../services/import/ats/adapters';
import { runDiscovery } from '../services/import/discovery/discovery.orchestrator';
import { enqueueScrapeJobs, getQueueStats } from '../services/import/discovery/queue';
import { runScrapeWorker } from '../services/import/discovery/scrapeWorker';
import {
  getDataFreshnessStats,
  getSourceHealthStats,
  getOpportunityDistribution,
} from '../services/import/cleanup.service';

const router = Router();

// All import routes require verified auth + admin role
const adminAuth = [verifiedMiddleware, adminMiddleware];

// GET /api/import/status — data freshness overview (legacy endpoint, kept for compatibility)
router.get('/status', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await getDataFreshnessStats()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/import/source-health — per-source success rate + last run for all 22 ENABLED sources
router.get('/source-health', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await getSourceHealthStats()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/import/distribution — opportunity counts by type / sector (tags) / region / country
router.get('/distribution', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await getOpportunityDistribution()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/import/compliance-report — aggregate robots.txt + ToS status for all CompanyWatchlist entries
router.get('/compliance-report', ...adminAuth, async (_req: Request, res: Response) => {
  try {
    const [companies, total, active] = await Promise.all([
      prisma.companyWatchlist.findMany({
        select: {
          id: true, name: true, careersUrl: true, sector: true, tier: true,
          isActive: true, robotsAllowed: true, tosAllowed: true, tosNotes: true,
          tosPageNotFound: true, robotsCheckedAt: true, tosAnalyzedAt: true, lastSyncedAt: true,
        },
      }),
      prisma.companyWatchlist.count(),
      prisma.companyWatchlist.count({ where: { isActive: true } }),
    ]);

    const robotsAllowed  = companies.filter(c => c.robotsAllowed === true).length;
    const robotsBlocked  = companies.filter(c => c.robotsAllowed === false).length;
    const robotsUnknown  = companies.filter(c => c.robotsAllowed === null).length;
    const tosAllowed     = companies.filter(c => c.tosAllowed === true).length;
    const tosBlocked     = companies.filter(c => c.tosAllowed === false).length;
    const tosUnknown     = companies.filter(c => c.tosAllowed === null).length;
    const neverChecked   = companies.filter(c => !c.robotsCheckedAt && !c.tosAnalyzedAt).length;

    const blocked = companies.filter(c => c.robotsAllowed === false || c.tosAllowed === false).map(c => ({
      name: c.name,
      careersUrl: c.careersUrl,
      reason: c.robotsAllowed === false ? 'robots' : 'tos',
      notes: c.tosNotes,
    }));

    const bySector: Record<string, { total: number; allowed: number; blocked: number; unknown: number }> = {};
    for (const c of companies) {
      if (!bySector[c.sector]) bySector[c.sector] = { total: 0, allowed: 0, blocked: 0, unknown: 0 };
      bySector[c.sector].total++;
      const fullyAllowed = c.robotsAllowed !== false && c.tosAllowed !== false;
      const anyBlocked   = c.robotsAllowed === false || c.tosAllowed === false;
      if (anyBlocked) bySector[c.sector].blocked++;
      else if (fullyAllowed && c.robotsAllowed !== null && c.tosAllowed !== null) bySector[c.sector].allowed++;
      else bySector[c.sector].unknown++;
    }

    res.json({
      summary: {
        total, active, inactive: total - active,
        robotsAllowed, robotsBlocked, robotsUnknown,
        tosAllowed, tosBlocked, tosUnknown,
        neverChecked,
        effectivelyBlocked: blocked.length,
      },
      blocked,
      bySector,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
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

// POST /api/import/anpal — manual trigger for ANPAL (Garanzia Giovani + SCU)
router.post('/anpal', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await importANPALOpportunities()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/f6s — DISABLED until C0 compliance verification; returns 503
router.post('/f6s', ...adminAuth, async (_req: Request, res: Response) => {
  try {
    const result = await importF6sOpportunities();
    if (result.imported === 0 && result.skipped === 0) {
      return res.status(503).json({
        error: 'F6S importer is DISABLED pending C0 compliance verification.',
        detail: 'See backend/src/services/import/f6s.import.ts for the C0 checklist.',
      });
    }
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/cleanup
router.post('/cleanup', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await runCleanup()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ---------------------------------------------------------------------------
// Import expansion: factory-driven ATS + discovery + scrape queue
// ---------------------------------------------------------------------------

// POST /api/import/ats/:platform — run one factory ATS platform (greenhouse|lever|ashby|workable|recruitee)
router.post('/ats/:platform', ...adminAuth, async (req: Request, res: Response) => {
  try {
    const adapter = ATS_ADAPTER_BY_PLATFORM[req.params.platform];
    if (!adapter) {
      return res.status(404).json({ error: `Unknown ATS platform: ${req.params.platform}`, supported: Object.keys(ATS_ADAPTER_BY_PLATFORM) });
    }
    resetDedupCache();
    res.json(await runAtsConnector(adapter));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/discovery/run — discover + register ATS boards into the registry
router.post('/discovery/run', ...adminAuth, async (req: Request, res: Response) => {
  try {
    const validate = req.body?.validate !== false;
    res.json(await runDiscovery({ validate }));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/queue/enqueue — create scrape jobs for due tier B/C companies
router.post('/queue/enqueue', ...adminAuth, async (req: Request, res: Response) => {
  try { res.json(await enqueueScrapeJobs({ force: req.body?.force === true, limit: req.body?.limit })); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/queue/drain — run the scrape worker over pending jobs
router.post('/queue/drain', ...adminAuth, async (req: Request, res: Response) => {
  try { resetDedupCache(); res.json(await runScrapeWorker({ limit: req.body?.limit })); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/import/queue/stats — pending/running/done/failed counts
router.get('/queue/stats', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await getQueueStats()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/import/registry/stats — registry breakdown by ATS type / tier / compliance / health
router.get('/registry/stats', ...adminAuth, async (_req: Request, res: Response) => {
  try {
    const [byAts, byTier, total, active, blocked, autoDisabled] = await Promise.all([
      prisma.companyWatchlist.groupBy({ by: ['atsType'], _count: { _all: true } }),
      prisma.companyWatchlist.groupBy({ by: ['scrapeTier'], _count: { _all: true } }),
      prisma.companyWatchlist.count(),
      prisma.companyWatchlist.count({ where: { isActive: true } }),
      prisma.companyWatchlist.count({ where: { OR: [{ robotsAllowed: false }, { tosAllowed: false }] } }),
      prisma.companyWatchlist.count({ where: { isActive: false, consecutiveFailures: { gte: 5 } } }),
    ]);
    res.json({
      total, active, inactive: total - active, complianceBlocked: blocked, autoDisabled,
      byAtsType: Object.fromEntries(byAts.map(r => [r.atsType ?? 'none', r._count._all])),
      byScrapeTier: Object.fromEntries(byTier.map(r => [r.scrapeTier ?? 'none', r._count._all])),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/import/all — run everything (ANPAL included; F6S skipped while DISABLED)
router.post('/all', ...adminAuth, async (_req: Request, res: Response) => {
  try {
    resetDedupCache(); const universities = await importUniversities();
    resetDedupCache(); const courses = await importCourses();
    resetDedupCache(); const eures = await importOpportunities();
    resetDedupCache(); const euYouth = await importEUOpportunities();
    resetDedupCache(); const almalaurea = await importAlmaLaureaStats();
    resetDedupCache(); const anpal = await importANPALOpportunities();
    const cleanup = await runCleanup();
    res.json({ universities, courses, eures, euYouth, almalaurea, anpal, cleanup });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
