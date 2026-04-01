import { Request, Response, NextFunction } from 'express';

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Accesso riservato agli amministratori' });
    return;
  }
  next();
}

export function moderatorMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !['ADMIN', 'MODERATOR'].includes(req.user.role)) {
    res.status(403).json({ error: 'Accesso riservato ai moderatori' });
    return;
  }
  next();
}
