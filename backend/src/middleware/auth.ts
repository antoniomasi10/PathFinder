import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { logSecurityEvent } from '../utils/securityLogger';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token mancante' });
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    logger.error('Access token verification failed');
    logSecurityEvent('AUTH_FAILED', { ip: req.ip, path: req.path });
    res.status(401).json({ error: 'Token non valido' });
  }
}

/**
 * Middleware that requires both authentication AND email verification.
 * Use this for protected routes that should only be accessible to verified users.
 */
export async function verifiedMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token mancante' });
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    req.user = verifyAccessToken(token);

    // Check email verification
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { emailVerified: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Utente non trovato' });
      return;
    }
    if (!user.emailVerified) {
      res.status(403).json({ error: 'Email non verificata', code: 'EMAIL_NOT_VERIFIED' });
      return;
    }
    next();
  } catch (err) {
    logger.error('Access token verification failed');
    logSecurityEvent('AUTH_FAILED', { ip: req.ip, path: req.path });
    res.status(401).json({ error: 'Token non valido' });
  }
}
