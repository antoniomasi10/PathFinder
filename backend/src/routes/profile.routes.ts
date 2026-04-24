import { Router, Request, Response } from 'express';
import { authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateProfileSchema } from '../schemas';
import { saveQuestionnaire, getProfile, getProfileForViewer, updateProfile, deleteAccount, searchUsers, getSuggestedUsers } from '../services/profile.service';
import { updateUserEmbedding } from '../services/embedding.service';
import { cacheDel } from '../lib/cache';

const router = Router();

router.post('/questionnaire', verifiedMiddleware, async (req: Request, res: Response) => {
  try {
    const profile = await saveQuestionnaire(req.user!.userId, req.body);
    updateUserEmbedding(req.user!.userId).catch(() => {});
    cacheDel(`cache:opps:*:${req.user!.userId}:*`).catch(() => {});
    res.json(profile);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/suggestions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const users = await getSuggestedUsers(req.user!.userId);
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', authMiddleware, async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    const clusterTag = (req.query.clusterTag as string | undefined) || undefined;
    const yearOfStudy = req.query.yearOfStudy ? parseInt(req.query.yearOfStudy as string) : undefined;
    const coreSkillArea = (req.query.coreSkillArea as string | undefined) || undefined;
    if (!q && !clusterTag && !yearOfStudy && !coreSkillArea) { res.json([]); return; }
    const users = await searchUsers(q || undefined, clusterTag, req.user!.userId, yearOfStudy, coreSkillArea);
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
    const profile = await getProfileForViewer(req.params.id, req.user!.userId);
    if (!profile) {
      res.status(404).json({ error: 'Profilo non trovato' });
      return;
    }
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/me', verifiedMiddleware, validate(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const updated = await updateProfile(req.user!.userId, req.body);
    updateUserEmbedding(req.user!.userId).catch(() => {});
    // Profile changed → matched/new opportunities may now differ for this user
    cacheDel(`cache:opps:*:${req.user!.userId}:*`).catch(() => {});
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    await deleteAccount(req.user!.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
