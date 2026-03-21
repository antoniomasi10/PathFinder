import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateProfileSchema } from '../schemas';
import { saveQuestionnaire, getProfile, updateProfile } from '../services/profile.service';
import prisma from '../lib/prisma';

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

    const requesterId = req.user!.userId;
    if (req.params.id !== requesterId) {
      const friendship = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { fromUserId: requesterId, toUserId: req.params.id, status: 'ACCEPTED' },
            { fromUserId: req.params.id, toUserId: requesterId, status: 'ACCEPTED' },
          ],
        },
      });
      if (!friendship) {
        // Return limited profile for non-friends
        res.json({
          id: profile.id,
          name: profile.name,
          avatar: profile.avatar,
          university: profile.university,
          courseOfStudy: profile.courseOfStudy,
        });
        return;
      }
    }
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/me', authMiddleware, validate(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const updated = await updateProfile(req.user!.userId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
