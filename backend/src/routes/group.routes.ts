import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as groupService from '../services/group.service';

const router = Router();

// Get user's groups
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const groups = await groupService.getUserGroups(req.user!.userId);
    res.json(groups);
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// Get single group
router.get('/:groupId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const group = await groupService.getGroup(req.params.groupId, req.user!.userId);
    res.json(group);
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// Create group
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, memberIds, description, image } = req.body;
    const group = await groupService.createGroup(
      req.user!.userId,
      name,
      memberIds,
      description,
      image,
    );
    res.status(201).json(group);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

// Update group
router.put('/:groupId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, description, image } = req.body;
    const group = await groupService.updateGroup(
      req.params.groupId,
      req.user!.userId,
      { name, description, image },
    );
    res.json(group);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

// Add member to group
router.post('/:groupId/members', authMiddleware, async (req: Request, res: Response) => {
  try {
    const member = await groupService.addMember(
      req.params.groupId,
      req.user!.userId,
      req.body.userId,
    );
    res.status(201).json(member);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

// Update group photo
router.put('/:groupId/photo', authMiddleware, async (req: Request, res: Response) => {
  try {
    const group = await groupService.updateGroupPhoto(
      req.params.groupId,
      req.user!.userId,
      req.body.image,
    );
    res.json(group);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

// Remove member from group
router.delete('/:groupId/members/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await groupService.removeMember(
      req.params.groupId,
      req.user!.userId,
      req.params.userId,
    );
    res.json(result);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

// Leave group
router.post('/:groupId/leave', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await groupService.leaveGroup(
      req.params.groupId,
      req.user!.userId,
    );
    res.json(result);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

// Delete group
router.delete('/:groupId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await groupService.deleteGroup(
      req.params.groupId,
      req.user!.userId,
    );
    res.json(result);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

export default router;
