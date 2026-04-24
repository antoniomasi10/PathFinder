import { Router, Request, Response } from 'express';
import { verifiedMiddleware as authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import { getHybridMatchedOpportunities, getNewOpportunities, OppFilters } from '../services/matchingEngine';
import { trackInteraction } from '../services/interaction.service';
import { cacheGet, cacheSet } from '../lib/cache';

const OPP_TTL = 5 * 60; // 5 minutes per-user opportunity cache

const router = Router();

// Get opportunities with optional matching and pagination
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const { matched, new: isNew } = req.query;

    // Parse common filters
    const filters: OppFilters = {};
    const search = (req.query.search as string || '').trim();
    if (search) filters.search = search;
    const company = (req.query.company as string || '').trim();
    if (company) filters.company = company;
    const location = (req.query.location as string || '').trim();
    if (location) filters.location = location;
    if (req.query.isRemote === 'true') filters.isRemote = true;
    if (req.query.isAbroad === 'true') filters.isAbroad = true;
    const englishLevel = (req.query.englishLevel as string || '');
    if (englishLevel) filters.englishLevels = englishLevel.split(',').filter(Boolean);
    const deadline = (req.query.deadline as string || '');
    if (deadline) filters.deadline = deadline;
    const hasFilters = Object.keys(filters).length > 0;

    if (isNew === 'true') {
      const filterKey = hasFilters ? JSON.stringify(filters) : '';
      const cacheKey = `cache:opps:new:${req.user!.userId}:${page}:${limit}:${filterKey}`;
      const cached = await cacheGet(cacheKey);
      if (cached) { res.json(cached); return; }

      const result = await getNewOpportunities(req.user!.userId, limit, skip, hasFilters ? filters : {});
      const payload = { data: result.data, total: result.total, page, totalPages: Math.ceil(result.total / limit) };
      await cacheSet(cacheKey, payload, OPP_TTL);
      res.json(payload);
      return;
    }

    if (matched === 'true') {
      const filterKey = hasFilters ? JSON.stringify(filters) : '';
      const cacheKey = `cache:opps:matched:${req.user!.userId}:${page}:${limit}:${filterKey}`;
      const cached = await cacheGet(cacheKey);
      if (cached) { res.json(cached); return; }

      const result = await getHybridMatchedOpportunities(req.user!.userId, limit, skip, hasFilters ? filters : {});
      const payload = { data: result.data, total: result.total, page, totalPages: Math.ceil(result.total / limit) };
      await cacheSet(cacheKey, payload, OPP_TTL);
      res.json(payload);
      return;
    }

    // Plain explore: build dynamic WHERE for raw SQL (avoids Unsupported vector column)
    const conditions: string[] = [];
    const params: any[] = [limit, skip];
    let idx = 3;

    if (search) {
      conditions.push(`(o."title" ILIKE $${idx} OR o."company" ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    if (company) {
      conditions.push(`o."company" ILIKE $${idx}`);
      params.push(`%${company}%`); idx++;
    }
    if (location) {
      conditions.push(`o."location" ILIKE $${idx}`);
      params.push(`%${location}%`); idx++;
    }
    if (req.query.isRemote === 'true') { conditions.push(`o."isRemote" = $${idx}`); params.push(true); idx++; }
    if (req.query.isAbroad === 'true') { conditions.push(`o."isAbroad" = $${idx}`); params.push(true); idx++; }
    if (englishLevel) {
      const levels = englishLevel.split(',').filter(Boolean);
      if (levels.length) {
        const placeholders = levels.map(() => `$${idx++}`).join(', ');
        conditions.push(`o."requiredEnglishLevel" IN (${placeholders})`);
        params.push(...levels);
      }
    }
    if (deadline === '7' || deadline === '30') {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setDate(end.getDate() + parseInt(deadline));
      conditions.push(`(o."deadline" >= $${idx} AND o."deadline" <= $${idx + 1})`);
      params.push(now, end); idx += 2;
    } else if (deadline === 'month') {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      conditions.push(`(o."deadline" >= $${idx} AND o."deadline" <= $${idx + 1})`);
      params.push(start, end); idx += 2;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count params exclude $1/$2 (limit/skip)
    const countParams = params.slice(2);
    const countConditions = conditions.map((c, i) => {
      // Re-index from $1 for count query
      return c.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) - 2}`);
    });
    const countWhere = countConditions.length ? `WHERE ${countConditions.join(' AND ')}` : '';

    const [opportunities, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT o."id", o."title", o."description", o."about", o."url", o."type",
                o."universityId", o."company", o."location", o."isRemote", o."isAbroad",
                o."requiredEnglishLevel", o."minGpa", o."tags", o."deadline",
                o."postedAt", o."expiresAt", o."source", o."sourceId", o."lastSyncedAt",
                u."name" as "universityName", u."city" as "universityCity",
                u."id" as "uniId", u."logoUrl" as "universityLogoUrl"
         FROM "Opportunity" o
         LEFT JOIN "University" u ON o."universityId" = u."id"
         ${whereClause}
         ORDER BY o."postedAt" DESC
         LIMIT $1 OFFSET $2`,
        ...params,
      ),
      countParams.length
        ? prisma.$queryRawUnsafe<[{ count: bigint }]>(
            `SELECT COUNT(*)::bigint as count FROM "Opportunity" o ${countWhere}`,
            ...countParams,
          )
        : prisma.opportunity.count(),
    ]);

    const total = countParams.length
      ? Number((countResult as [{ count: bigint }])[0].count)
      : (countResult as number);

    res.json({ data: opportunities, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get saved opportunities — must be defined before /:id routes
router.get('/saved', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { savedOpportunities: { include: { university: true } } },
    });
    res.json(user?.savedOpportunities || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Track view interaction
router.post('/:id/view', authMiddleware, async (req: Request, res: Response) => {
  try {
    trackInteraction(req.user!.userId, 'opportunity', req.params.id, 'view').catch(() => {});
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save/unsave opportunity
router.post('/:id/save', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { savedOpportunities: { where: { id: req.params.id } } },
    });

    if (user?.savedOpportunities.length) {
      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { savedOpportunities: { disconnect: { id: req.params.id } } },
      });
      trackInteraction(req.user!.userId, 'opportunity', req.params.id, 'unsave').catch(() => {});
      res.json({ saved: false });
    } else {
      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { savedOpportunities: { connect: { id: req.params.id } } },
      });
      trackInteraction(req.user!.userId, 'opportunity', req.params.id, 'save').catch(() => {});
      res.json({ saved: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
