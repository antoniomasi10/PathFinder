import { Router, Request, Response } from 'express';
import { verifiedMiddleware as authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import { sendContactEmail, sendReportEmail } from '../services/email.service';

const router = Router();

router.post('/contact', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { subject, message } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Oggetto e messaggio sono obbligatori' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true, name: true, surname: true },
    });
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    const name = `${user.name} ${user.surname}`.trim();
    await sendContactEmail(user.email, name, subject.trim(), message.trim());

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/report', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { category, description } = req.body;
    if (!category?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'Categoria e descrizione sono obbligatorie' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true, name: true, surname: true },
    });
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    const name = `${user.name} ${user.surname}`.trim();
    await sendReportEmail(user.email, name, category.trim(), description.trim());

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
