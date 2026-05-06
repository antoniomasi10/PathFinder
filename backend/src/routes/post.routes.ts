import { Router, Request, Response } from 'express';
import { verifiedMiddleware as authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPostSchema, createCommentSchema, reportSchema } from '../schemas';
import * as postService from '../services/post.service';
import { createNotification } from '../services/notification.service';
import { validateImages } from '../utils/imageValidation';
import { uploadImages } from '../utils/imageUpload';
import { moderateContent } from '../utils/moderation';
import prisma from '../lib/prisma';
import { trackInteraction } from '../services/interaction.service';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const q = (req.query.q as string | undefined)?.trim();
    if (q) {
      const sortBy = req.query.sortBy === 'likes' ? 'likes' : 'recent';
      const posts = await postService.searchPosts(q, page, 20, req.user!.userId, sortBy);
      res.json(posts);
      return;
    }
    const posts = await postService.getPersonalizedPosts(page, 20, req.user!.userId);
    res.json(posts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, validate(createPostSchema), async (req: Request, res: Response) => {
  try {
    const { content, images } = req.body;

    const mod = moderateContent(content);
    if (mod.action === 'HARD_BLOCK') {
      res.status(400).json({ error: mod.reason, code: 'CONTENT_BLOCKED' });
      return;
    }

    const validImages = validateImages(images);
    const imageUrls = await uploadImages(validImages, 'posts');
    const post = await postService.createPost(req.user!.userId, content, imageUrls, mod.action === 'FLAG');
    res.status(201).json(post);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Edit post (author only)
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content, images } = req.body;
    if (!content || typeof content !== 'string' || content.length === 0 || content.length > 10000) {
      res.status(400).json({ error: 'Contenuto non valido' });
      return;
    }
    let imageUrls: string[] | undefined;
    if (images !== undefined) {
      const validImages = validateImages(images);
      imageUrls = await uploadImages(validImages, 'posts');
    }
    const post = await postService.updatePost(req.params.id, req.user!.userId, content, imageUrls);
    res.json(post);
  } catch (err: any) {
    const status = err.message.includes('non trovato') ? 404 : err.message.includes('non puoi') ? 403 : 400;
    res.status(status).json({ error: err.message });
  }
});

router.post('/:id/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    await postService.likePost(req.params.id, req.user!.userId);
    trackInteraction(req.user!.userId, 'post', req.params.id, 'like').catch(() => {});
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
        `/networking?post=${post.id}`,
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

router.post('/:id/comments', authMiddleware, validate(createCommentSchema), async (req: Request, res: Response) => {
  try {
    const mod = moderateContent(req.body.content);
    if (mod.action === 'HARD_BLOCK') {
      res.status(400).json({ error: mod.reason, code: 'CONTENT_BLOCKED' });
      return;
    }

    const comment = await postService.createComment(req.params.id, req.user!.userId, req.body.content, mod.action === 'FLAG');
    trackInteraction(req.user!.userId, 'post', req.params.id, 'comment').catch(() => {});
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
        `/networking?post=${post.id}`,
        '\u{1F4AC}',
        { postId: post.id, fromUserId: req.user!.userId }
      );
    }
    res.status(201).json(comment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/comments/:commentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const comment = await prisma.postComment.findUnique({
      where: { id: req.params.commentId },
      select: { authorId: true, postId: true },
    });

    if (!comment) {
      res.status(404).json({ error: 'Commento non trovato' });
      return;
    }

    if (comment.postId !== req.params.id) {
      res.status(400).json({ error: 'Commento non appartiene a questo post' });
      return;
    }

    // Allow: comment author, post owner, MODERATOR, ADMIN
    const post = await prisma.post.findUnique({ where: { id: req.params.id }, select: { authorId: true } });
    const userRole = req.user!.role;
    const isCommentAuthor = comment.authorId === req.user!.userId;
    const isPostOwner = post?.authorId === req.user!.userId;
    const isMod = ['ADMIN', 'MODERATOR'].includes(userRole);

    if (!isCommentAuthor && !isPostOwner && !isMod) {
      res.status(403).json({ error: 'Non puoi eliminare questo commento' });
      return;
    }

    await prisma.postComment.delete({ where: { id: req.params.commentId } });
    res.json({ message: 'Commento eliminato' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/report', authMiddleware, validate(reportSchema), async (req: Request, res: Response) => {
  try {
    await postService.reportPost(req.params.id, req.user!.userId, req.body.reason);
    res.json({ message: 'Segnalazione inviata' });
  } catch (err: any) {
    const status = err.message.includes('non trovato') ? 404 : err.message.includes('già segnalato') || err.message.includes('tuo stesso') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.post('/:id/comments/:commentId/report', authMiddleware, validate(reportSchema), async (req: Request, res: Response) => {
  try {
    await postService.reportComment(req.params.commentId, req.user!.userId, req.body.reason);
    res.json({ message: 'Segnalazione inviata' });
  } catch (err: any) {
    const status = err.message.includes('non trovato') ? 404 : err.message.includes('già segnalato') || err.message.includes('tuo stesso') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: { authorId: true },
    });

    if (!post) {
      res.status(404).json({ error: 'Post non trovato' });
      return;
    }

    // Allow author, moderators, and admins to delete posts
    const userRole = req.user!.role;
    if (post.authorId !== req.user!.userId && !['ADMIN', 'MODERATOR'].includes(userRole)) {
      res.status(403).json({ error: 'Non puoi eliminare il post di un altro utente' });
      return;
    }

    await prisma.post.delete({ where: { id: req.params.id } });
    res.json({ message: 'Post eliminato' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
