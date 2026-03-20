import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { logSecurityEvent } from '../utils/securityLogger';
import { logger } from '../utils/logger';

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
    logger.error('Access token verification failed', { error: String(err) });
    logSecurityEvent('AUTH_FAILED', { ip: req.ip, path: req.path });
    res.status(401).json({ error: 'Token non valido' });
  }
}
