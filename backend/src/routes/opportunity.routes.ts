import { Router, Request, Response } from 'express';
import { verifiedMiddleware as authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import { getHybridMatchedOpportunities } from '../services/matchingEngine';
import { trackInteraction } from '../services/interaction.service';

const router = Router();

// Get opportunities with optional matching and pagination
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const { matched } = req.query;
    if (matched === 'true') {
      // Use hybrid two-stage scoring (V1 or V2 based on A/B test)
      const result = await getHybridMatchedOpportunities(req.user!.userId, limit, skip);
      res.json({
        data: result.data,
        total: result.total,
        page,
        totalPages: Math.ceil(result.total / limit),
      });
      return;
    }

    const [opportunities, total] = await Promise.all([
      prisma.opportunity.findMany({
        include: { university: true },
        orderBy: { postedAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.opportunity.count(),
    ]);

    res.json({ data: opportunities, total, page, totalPages: Math.ceil(total / limit) });
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

// Track apply click (user clicked "Vai all'opportunità")
router.post('/:id/apply-click', authMiddleware, async (req: Request, res: Response) => {
  try {
    trackInteraction(req.user!.userId, 'opportunity', req.params.id, 'apply_clicked').catch(() => {});
    res.json({ tracked: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Track opportunity view (user expanded card)
router.post('/:id/view', authMiddleware, async (req: Request, res: Response) => {
  try {
    trackInteraction(req.user!.userId, 'opportunity', req.params.id, 'view').catch(() => {});
    res.json({ tracked: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get saved opportunities
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

export default router;
