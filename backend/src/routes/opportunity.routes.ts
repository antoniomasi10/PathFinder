import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import { scoreOpportunity } from '../services/matchingEngine';

const router = Router();

// Get opportunities with optional matching and pagination
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const { matched } = req.query;
    if (matched === 'true') {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { profile: true },
      });

      if (user?.profile) {
        // For matched results, we need all opportunities to score and sort them
        const allOpportunities = await prisma.opportunity.findMany({
          include: { university: true },
          orderBy: { postedAt: 'desc' },
        });

        const scored = allOpportunities.map((opp) => ({
          ...opp,
          matchScore: scoreOpportunity(user.profile!, user, opp),
          matchReason: getMatchReason(user.profile!, user, opp),
        }));
        scored.sort((a, b) => b.matchScore - a.matchScore);

        const paginated = scored.slice(skip, skip + limit);
        res.json({ data: paginated, total: scored.length, page, totalPages: Math.ceil(scored.length / limit) });
        return;
      }
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
      res.json({ saved: false });
    } else {
      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { savedOpportunities: { connect: { id: req.params.id } } },
      });
      res.json({ saved: true });
    }
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

function getMatchReason(profile: any, user: any, opp: any): string {
  const reasons: string[] = [];
  if (profile.primaryInterest === 'tech' && (opp.type === 'INTERNSHIP' || opp.type === 'STAGE')) {
    reasons.push('In linea con i tuoi interessi tech');
  }
  if (profile.primaryInterest === 'business' && opp.type === 'FELLOWSHIP') {
    reasons.push('Perfetto per il tuo percorso imprenditoriale');
  }
  if (profile.clusterTag === 'Creativo' && opp.type === 'EXTRACURRICULAR') {
    reasons.push('Adatto al tuo profilo creativo');
  }
  if (opp.isRemote && user.willingToRelocate === 'NO') {
    reasons.push('Disponibile in remoto');
  }
  if (reasons.length === 0) reasons.push('Opportunità consigliata per te');
  return reasons.join(' · ');
}

export default router;
