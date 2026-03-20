import { Request, Response } from 'express';
import { registerUser, loginUser } from '../services/auth.service';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { logSecurityEvent } from '../utils/securityLogger';
import { logger } from '../utils/logger';

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password, universityId, courseOfStudy } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nome, email e password sono obbligatori' });
      return;
    }
    const result = await registerUser({ name, email, password, universityId, courseOfStudy });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    logSecurityEvent('REGISTER', { userId: result.user.id, email });
    res.status(201).json({ user: result.user, accessToken: result.accessToken });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email e password sono obbligatori' });
      return;
    }
    const result = await loginUser({ email, password });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    logSecurityEvent('LOGIN_SUCCESS', { userId: result.user.id, email });
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (err: any) {
    logSecurityEvent('LOGIN_FAILED', { email: req.body.email });
    res.status(401).json({ error: err.message });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ error: 'Refresh token mancante' });
      return;
    }
    const payload = verifyRefreshToken(token);
    const accessToken = generateAccessToken({ userId: payload.userId, email: payload.email });
    const newRefreshToken = generateRefreshToken({ userId: payload.userId, email: payload.email });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    logSecurityEvent('TOKEN_REFRESH', { userId: payload.userId });
    res.json({ accessToken });
  } catch (err) {
    logger.error('Refresh token verification failed', { error: String(err) });
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(401).json({ error: 'Token non valido' });
  }
}
