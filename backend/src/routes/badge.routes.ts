import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getUserBadges, trackAction, getTrackingValues } from '../services/badge.service';

const router = Router();

// Get all badges with progress for the authenticated user
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const badges = await getUserBadges(req.user!.userId);
    res.json(badges);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get tracking values
router.get('/tracking', authMiddleware, async (req: Request, res: Response) => {
  try {
    const values = await getTrackingValues(req.user!.userId);
    res.json(values);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Track an action (increment a tracking key)
router.post('/track', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { key, increment } = req.body;
    if (!key || typeof key !== 'string') {
      res.status(400).json({ error: 'key è obbligatorio' });
      return;
    }
    const result = await trackAction(req.user!.userId, key, increment ?? 1);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
