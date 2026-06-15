import { Router, Request, Response } from 'express';
import { verifiedMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import prisma from '../lib/prisma';
import { logSecurityEvent } from '../utils/securityLogger';
import { createNotification } from '../services/notification.service';
import { runStructuredContentBatch } from '../services/structuredContentJob';
import { backfillContextualizedSkillsBoot } from '../services/ai/opportunityParser';
import { runRewriteTitlesBatch } from '../services/translationJob';
import { Prisma } from '@prisma/client';

const router = Router();
const adminAuth = [verifiedMiddleware, adminMiddleware];

// GET /api/admin/users — paginated user list with search
router.get('/users', ...adminAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = (req.query.search as string) || '';
    const role = req.query.role as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { surname: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role && ['USER', 'MODERATOR', 'ADMIN'].includes(role)) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          role: true,
          emailVerified: true,
          provider: true,
          createdAt: true,
          university: { select: { name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ data: users, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id/role — change user role
router.patch('/users/:id/role', ...adminAuth, async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    if (!role || !['USER', 'MODERATOR', 'ADMIN'].includes(role)) {
      res.status(400).json({ error: 'Ruolo non valido. Valori ammessi: USER, MODERATOR, ADMIN' });
      return;
    }

    const targetUserId = req.params.id;
    const currentUserId = req.user!.userId;

    // Prevent self-demotion if sole admin
    if (targetUserId === currentUserId && role !== 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        res.status(400).json({ error: 'Non puoi rimuovere il tuo ruolo ADMIN: sei l\'unico amministratore' });
        return;
      }
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }

    if (targetUser.role === role) {
      res.json({ message: `L'utente ha già il ruolo ${role}` });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    logSecurityEvent('ROLE_CHANGED', {
      targetUserId,
      oldRole: targetUser.role,
      newRole: role,
      changedBy: currentUserId,
    });

    // Notify the affected user
    await createNotification(
      targetUserId,
      'SYSTEM',
      `Il tuo ruolo è stato aggiornato a ${role}`,
      undefined,
      '\u{1F6E1}\u{FE0F}',
    );

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/backfill/status — count opportunities missing AI-generated fields
router.get('/backfill/status', ...adminAuth, async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const activeFilter = { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };

    const [missingStructured, missingContextualized] = await Promise.all([
      prisma.opportunity.count({
        where: { structuredContent: { equals: Prisma.DbNull }, ...activeFilter },
      }),
      prisma.opportunity.count({
        where: { type: 'TIROCINIO', contextualizedSkills: { isEmpty: true }, ...activeFilter },
      }),
    ]);

    res.json({ missingStructuredContent: missingStructured, missingContextualizedSkills: missingContextualized });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/backfill/structured-content — trigger immediate backfill (up to 5000)
router.post('/backfill/structured-content', ...adminAuth, async (_req: Request, res: Response) => {
  try {
    const result = await runStructuredContentBatch(5000);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/backfill/contextualized-skills — trigger immediate contextualizedSkills backfill (up to 5000)
router.post('/backfill/contextualized-skills', ...adminAuth, async (_req: Request, res: Response) => {
  try {
    await backfillContextualizedSkillsBoot(5000);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/backfill/rewrite-titles — rewrite titleIt for all active opportunities with current prompt
router.post('/backfill/rewrite-titles', ...adminAuth, (_req: Request, res: Response) => {
  res.json({ ok: true, message: 'Rewrite started in background — check server logs for [RewriteJob]' });
  runRewriteTitlesBatch(5000).catch((err) =>
    console.error('[RewriteJob] Fatal error:', err),
  );
});

export default router;
