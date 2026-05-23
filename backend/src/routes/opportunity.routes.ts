import { Router, Request, Response } from 'express';
import { verifiedMiddleware as authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import { getHybridMatchedOpportunities, getHybridMatchedOpportunitiesFull, getNewOpportunitiesFull, getRelatedOpportunities, scoreOpportunity, OppFilters } from '../services/matchingEngine';
import { trackInteraction } from '../services/interaction.service';
import { cacheGet, cacheSet, cacheDel } from '../lib/cache';
import { translateOpportunities } from '../services/opportunityTranslation.service';
import { resolveLocationTokens } from '../services/locationFilter';

const VALID_LANGS = new Set(['en', 'es', 'fr', 'zh']);

const OPP_TTL = 5 * 60; // 5 minutes per-user opportunity cache

const router = Router();

// Get opportunities with optional matching and pagination
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const { matched, new: isNew } = req.query;
    const lang = VALID_LANGS.has(req.query.lang as string) ? (req.query.lang as string) : 'it';

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
    const typeParam = (req.query.type as string || '');
    const typeFilters = typeParam ? typeParam.split(',').filter(Boolean) : [];
    if (typeFilters.length) filters.types = typeFilters;
    const formatParam = (req.query.format as string || '');
    const formatFilters = formatParam ? formatParam.split(',').filter(Boolean) : [];
    if (formatFilters.length) filters.formats = formatFilters;
    const hasFilters = Object.keys(filters).length > 0;

    const minScoreParam = parseFloat(req.query.minScore as string);
    const maxScoreParam = parseFloat(req.query.maxScore as string);

    if (isNew === 'true') {
      const filterKey = hasFilters ? JSON.stringify(filters) : '';
      // Snapshot cache: one entry holds the full ordered list. Pagination is a slice
      // over the same snapshot, so an opp can never appear on two different pages
      // within a snapshot window (TTL: OPP_TTL).
      const cacheKey = `cache:opps:new:${req.user!.userId}:${filterKey}:${lang}`;
      let snapshot = await cacheGet(cacheKey) as any[] | null;
      if (!snapshot) {
        snapshot = await getNewOpportunitiesFull(req.user!.userId, hasFilters ? filters : {});
        if (lang !== 'it') await translateOpportunities(snapshot, lang);
        await cacheSet(cacheKey, snapshot, OPP_TTL);
      }
      if (!isNaN(minScoreParam) || !isNaN(maxScoreParam)) {
        snapshot = snapshot.filter((o: any) => {
          const score = o.matchScore ?? 0;
          if (!isNaN(minScoreParam) && score < minScoreParam) return false;
          if (!isNaN(maxScoreParam) && score > maxScoreParam) return false;
          return true;
        });
      }
      const data = snapshot.slice(skip, skip + limit);
      res.json({ data, total: snapshot.length, page, totalPages: Math.ceil(snapshot.length / limit) });
      return;
    }

    if (matched === 'true') {
      const filterKey = hasFilters ? JSON.stringify(filters) : '';
      const cacheKey = `cache:opps:matched:${req.user!.userId}:${filterKey}:${lang}`;
      let snapshot = await cacheGet(cacheKey) as any[] | null;
      if (!snapshot) {
        snapshot = await getHybridMatchedOpportunitiesFull(req.user!.userId, hasFilters ? filters : {});
        if (lang !== 'it') await translateOpportunities(snapshot, lang);
        await cacheSet(cacheKey, snapshot, OPP_TTL);
      }
      if (!isNaN(minScoreParam) || !isNaN(maxScoreParam)) {
        snapshot = snapshot.filter((o: any) => {
          const score = o.matchScore ?? 0;
          if (!isNaN(minScoreParam) && score < minScoreParam) return false;
          if (!isNaN(maxScoreParam) && score > maxScoreParam) return false;
          return true;
        });
      }
      const data = snapshot.slice(skip, skip + limit);
      res.json({ data, total: snapshot.length, page, totalPages: Math.ceil(snapshot.length / limit) });
      return;
    }

    // Plain explore: build dynamic WHERE for raw SQL (avoids Unsupported vector column)
    const conditions: string[] = [
      `(o."expiresAt" IS NULL OR o."expiresAt" > NOW())`,
      // For EVENT, deadline is meaningless — visibility is bounded by endDate.
      `(o."type" IN ('EVENT') OR o."deadline" IS NULL OR o."deadline" > NOW())`,
      `(o."type" NOT IN ('EVENT') OR o."endDate" IS NULL OR o."endDate" >= CURRENT_DATE)`,
      `(o."urlStatus" IS NULL OR o."urlStatus" != 'BROKEN' OR o."source" = 'curated')`,
    ];
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
      // Tokenize the input so "Roma Italia" or "Berlin, DE" resolve each piece.
      // Per-token clauses are OR'd together so any match qualifies.
      const tokens = resolveLocationTokens(location);
      const orClauses: string[] = [];
      for (const { iso, term } of tokens) {
        if (iso) {
          orClauses.push(`(o."location" ILIKE $${idx} OR o."city" ILIKE $${idx + 1} OR o."country" = $${idx + 2})`);
          params.push(`%${term}%`, `%${term}%`, iso); idx += 3;
        } else {
          orClauses.push(`(o."location" ILIKE $${idx} OR o."city" ILIKE $${idx + 1})`);
          params.push(`%${term}%`, `%${term}%`); idx += 2;
        }
      }
      if (orClauses.length) conditions.push(`(${orClauses.join(' OR ')})`);
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
    if (typeFilters.length === 1) {
      conditions.push(`o."type" = $${idx++}`);
      params.push(typeFilters[0]);
    } else if (typeFilters.length > 1) {
      const placeholders = typeFilters.map(() => `$${idx++}`).join(', ');
      conditions.push(`o."type" IN (${placeholders})`);
      params.push(...typeFilters);
    }
    if (formatFilters.length === 1) {
      conditions.push(`o."format" = $${idx++}`);
      params.push(formatFilters[0]);
    } else if (formatFilters.length > 1) {
      const placeholders = formatFilters.map(() => `$${idx++}`).join(', ');
      conditions.push(`o."format" IN (${placeholders})`);
      params.push(...formatFilters);
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
        `SELECT o."id", o."title", o."description", o."titleIt", o."descriptionIt", o."about", o."url", o."type",
                o."universityId", o."company", o."organizer", o."location", o."city", o."country", o."isRemote", o."isAbroad",
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

    if (lang !== 'it') await translateOpportunities(opportunities, lang);
    res.json({ data: opportunities, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get the deterministic "opportunity of the day" for this user
// Same user + same calendar day (Europe/Rome) → same opportunity guaranteed.
router.get('/daily', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const romeDateStr = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Rome' }); // YYYY-MM-DD
    const cacheKey = `cache:opp:daily:${userId}:${romeDateStr}`;
    const historyKey = `cache:opp:daily:history:${userId}`;

    const cached = await cacheGet<any>(cacheKey);
    if (cached) { res.json(cached); return; }

    // Exclude opps the user has interacted with in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentInteractions = await prisma.userInteraction.findMany({
      where: { userId, targetType: 'opportunity', createdAt: { gte: sevenDaysAgo } },
      select: { targetId: true },
    });
    const interactedIds = new Set(recentInteractions.map(i => i.targetId));

    // Exclude opps shown as daily in the last 7 days (cross-day variety)
    const history = (await cacheGet<{ date: string; oppId: string }[]>(historyKey)) ?? [];
    const recentDailyIds = new Set(history.map(h => h.oppId));

    const result = await getHybridMatchedOpportunities(userId, 50, 0, {});
    const candidates = result.data.filter(o => !interactedIds.has(o.id) && !recentDailyIds.has(o.id));
    const pool = candidates.length > 0 ? candidates : result.data; // fallback if all filtered out
    if (!pool.length) { res.json(null); return; }

    // Top by matchScore — re-sort because the pipeline applies MMR/freshness that
    // can displace the highest-scoring opp.
    const daily = [...pool].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))[0];

    // TTL = seconds remaining until midnight Rome time
    const romeNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
    const endOfDay = new Date(romeNow); endOfDay.setHours(23, 59, 59, 999);
    const ttl = Math.max(60, Math.floor((endOfDay.getTime() - romeNow.getTime()) / 1000));

    await cacheSet(cacheKey, daily, ttl);

    // Push to history (keep last 7 entries), 8-day TTL
    const updatedHistory = [{ date: romeDateStr, oppId: daily.id }, ...history.filter(h => h.oppId !== daily.id)].slice(0, 7);
    await cacheSet(historyKey, updatedHistory, 8 * 24 * 60 * 60);

    res.json(daily);
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

function invalidateUserOppCache(userId: string): void {
  Promise.all([
    cacheDel(`cache:opps:matched:${userId}:*`),
    cacheDel(`cache:opps:new:${userId}:*`),
  ]).catch(() => {});
}

// Get opportunities semantically related to a given opportunity, re-ranked by user match score.
// Must appear before /:id to avoid Express treating "related" as an id parameter.
router.get('/:id/related', authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);
    const related = await getRelatedOpportunities(req.user!.userId, req.params.id, limit);
    res.json({ data: related, total: related.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single opportunity by id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [opp, user, savedCount] = await Promise.all([
      prisma.opportunity.findUnique({
        where: { id: req.params.id },
        include: { university: true },
      }),
      prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { profile: true },
      }),
      prisma.user.count({ where: { savedOpportunities: { some: { id: req.params.id } } } }),
    ]);
    if (!opp) { res.status(404).json({ error: 'Not found' }); return; }
    const matchScore = user?.profile
      ? Math.max(0, Math.min(100, Math.round(scoreOpportunity(user.profile, user, opp as any))))
      : 0;
    res.json({ ...opp, savedCount, matchScore });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Track view interaction.
// Note: we intentionally do NOT invalidate the matched/new snapshot cache here —
// freshness penalty and view multiplier should affect the NEXT browsing session,
// not shuffle ranks mid-pagination (which causes cross-page duplicates).
router.post('/:id/view', authMiddleware, async (req: Request, res: Response) => {
  try {
    trackInteraction(req.user!.userId, 'opportunity', req.params.id, 'view').catch(() => {});
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Track external link click (same caching rationale as /view).
router.post('/:id/click', authMiddleware, async (req: Request, res: Response) => {
  try {
    trackInteraction(req.user!.userId, 'opportunity', req.params.id, 'click').catch(() => {});
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
