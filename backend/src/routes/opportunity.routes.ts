import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import { scoreOpportunity } from '../services/matchingEngine';

const router = Router();

// Get opportunities with optional matching
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const opportunities = await prisma.opportunity.findMany({
      include: { university: true },
      orderBy: { postedAt: 'desc' },
    });

    const { matched } = req.query;
    if (matched === 'true') {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { profile: true },
      });

      if (user?.profile) {
        const scored = opportunities.map((opp) => ({
          ...opp,
          matchScore: scoreOpportunity(user.profile!, user, opp),
          matchReason: getMatchReason(user.profile!, user, opp),
        }));
        scored.sort((a, b) => b.matchScore - a.matchScore);
        res.json(scored);
        return;
      }
    }

    res.json(opportunities);
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
