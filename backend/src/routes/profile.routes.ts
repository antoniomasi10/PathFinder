import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { saveQuestionnaire, getProfile, updateProfile } from '../services/profile.service';

const router = Router();

router.post('/questionnaire', authMiddleware, async (req: Request, res: Response) => {
  try {
    const profile = await saveQuestionnaire(req.user!.userId, req.body);
    res.json(profile);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const profile = await getProfile(req.user!.userId);
    if (!profile) {
      res.status(404).json({ error: 'Profilo non trovato' });
      return;
    }
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const profile = await getProfile(req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'Profilo non trovato' });
      return;
    }
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const updated = await updateProfile(req.user!.userId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
