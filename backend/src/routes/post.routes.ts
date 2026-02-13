import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as postService from '../services/post.service';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const posts = await postService.getPosts(page);
    res.json(posts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const post = await postService.createPost(req.user!.userId, req.body.content);
    res.status(201).json(post);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    await postService.likePost(req.params.id, req.user!.userId);
    res.json({ liked: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    await postService.unlikePost(req.params.id, req.user!.userId);
    res.json({ liked: false });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const comments = await postService.getComments(req.params.id);
    res.json(comments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const comment = await postService.createComment(req.params.id, req.user!.userId, req.body.content);
    res.status(201).json(comment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
