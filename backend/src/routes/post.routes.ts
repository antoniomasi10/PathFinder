import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as postService from '../services/post.service';
import { createNotification } from '../services/notification.service';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const posts = await postService.getPosts(page, 20, req.user!.userId);
    res.json(posts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content, images } = req.body;
    const validImages = Array.isArray(images)
      ? images.filter((img: any) => typeof img === 'string' && img.startsWith('data:image/')).slice(0, 5)
      : [];
    const post = await postService.createPost(req.user!.userId, content, validImages);
    res.status(201).json(post);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    await postService.likePost(req.params.id, req.user!.userId);
    const post = await postService.getPostById(req.params.id);
    if (post && post.authorId !== req.user!.userId) {
      const liker = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { name: true },
      });
      await createNotification(
        post.authorId,
        'POST_LIKE',
        `${liker?.name || 'Qualcuno'} ha messo mi piace al tuo post`,
        `/networking`,
        '\u{2764}\u{FE0F}',
        { postId: post.id, fromUserId: req.user!.userId }
      );
    }
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
    const post = await postService.getPostById(req.params.id);
    if (post && post.authorId !== req.user!.userId) {
      const commenter = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { name: true },
      });
      const preview = req.body.content.length > 30
        ? req.body.content.substring(0, 30) + '...'
        : req.body.content;
      await createNotification(
        post.authorId,
        'POST_COMMENT',
        `${commenter?.name || 'Qualcuno'} ha commentato: "${preview}"`,
        `/networking`,
        '\u{1F4AC}',
        { postId: post.id, fromUserId: req.user!.userId }
      );
    }
    res.status(201).json(comment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
