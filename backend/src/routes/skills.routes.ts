import { Router, Request, Response } from 'express';
import { verifiedMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { coreSkillsSchema, sideSkillSchema, promptActionSchema } from '../schemas';
import {
  setCoreSkills,
  updateCoreSkills,
  addSideSkill,
  removeSideSkill,
  updatePromptStatus,
  shouldPrompt,
} from '../services/skills.service';

const router = Router();

// Authorization helper: user can only manage their own skills
function assertOwner(req: Request, res: Response): boolean {
  if (req.user!.userId !== req.params.userId) {
    res.status(403).json({ error: 'Non autorizzato' });
    return false;
  }
  return true;
}

// POST /api/v1/users/:userId/skills/core — set core skills for the first time
router.post(
  '/:userId/skills/core',
  verifiedMiddleware,
  validate(coreSkillsSchema),
  async (req: Request, res: Response) => {
    if (!assertOwner(req, res)) return;
    try {
      const result = await setCoreSkills(req.params.userId, req.body.coreSkills);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
);

// PUT /api/v1/users/:userId/skills/core — update existing core skills
router.put(
  '/:userId/skills/core',
  verifiedMiddleware,
  validate(coreSkillsSchema),
  async (req: Request, res: Response) => {
    if (!assertOwner(req, res)) return;
    try {
      const result = await updateCoreSkills(req.params.userId, req.body.coreSkills);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
);

// POST /api/v1/users/:userId/skills/side — add a side skill
router.post(
  '/:userId/skills/side',
  verifiedMiddleware,
  validate(sideSkillSchema),
  async (req: Request, res: Response) => {
    if (!assertOwner(req, res)) return;
    try {
      const result = await addSideSkill(req.params.userId, req.body.skillId, req.body.name);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
);

// DELETE /api/v1/users/:userId/skills/side/:skillId — remove a side skill
router.delete(
  '/:userId/skills/side/:skillId',
  verifiedMiddleware,
  async (req: Request, res: Response) => {
    if (!assertOwner(req, res)) return;
    try {
      const result = await removeSideSkill(req.params.userId, req.params.skillId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
);

// PATCH /api/v1/users/:userId/skills/prompt — update prompt status
router.patch(
  '/:userId/skills/prompt',
  verifiedMiddleware,
  validate(promptActionSchema),
  async (req: Request, res: Response) => {
    if (!assertOwner(req, res)) return;
    try {
      const result = await updatePromptStatus(req.params.userId, req.body.action);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
);

// GET /api/v1/users/:userId/skills/should-prompt — check if prompt should show
router.get(
  '/:userId/skills/should-prompt',
  verifiedMiddleware,
  async (req: Request, res: Response) => {
    if (!assertOwner(req, res)) return;
    try {
      const shouldShow = await shouldPrompt(req.params.userId);
      res.json({ shouldShow });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;
