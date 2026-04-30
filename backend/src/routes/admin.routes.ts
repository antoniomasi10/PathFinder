import { Router, Request, Response } from 'express';
import { verifiedMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import prisma from '../lib/prisma';
import { logSecurityEvent } from '../utils/securityLogger';
import { createNotification } from '../services/notification.service';
import { buildClearbitLogoUrl, runWithConcurrency } from '../services/import/utils';

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

// POST /api/admin/opportunities/enrich-logos
// Backfills companyLogoUrl for existing opportunities that have a url but no logo.
router.post('/opportunities/enrich-logos', ...adminAuth, async (req: Request, res: Response) => {
  try {
    const opportunities = await prisma.opportunity.findMany({
      where: { companyLogoUrl: null, url: { not: null } },
      select: { id: true, url: true },
    });

    let updated = 0;
    await runWithConcurrency(opportunities, 10, async (opp) => {
      const logoUrl = buildClearbitLogoUrl(opp.url);
      if (!logoUrl) return;
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { companyLogoUrl: logoUrl },
      });
      updated++;
    });

    res.json({ processed: opportunities.length, updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
