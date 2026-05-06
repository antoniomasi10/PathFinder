import { Request, Response } from 'express';
import {
  registerUser,
  loginUser,
  verifyEmail,
  resendVerificationCode,
  forgotPassword,
  resetPassword,
  googleAuth,
  changePassword,
} from '../services/auth.service';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { logSecurityEvent } from '../utils/securityLogger';
import { logger } from '../utils/logger';
import { trackLoginStreak } from '../services/badge.service';
import { blacklistToken, isTokenBlacklisted, trackUserToken, invalidateAllUserTokens } from '../utils/tokenBlacklist';

function setRefreshCookie(res: Response, token: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: true,
    sameSite: isProduction ? 'none' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

export async function register(req: Request, res: Response) {
  try {
    const { name, surname, email, password, phone, universityId, courseOfStudy } = req.body;
    if (!name || !surname || !email || !password) {
      res.status(400).json({ error: 'Nome, cognome, email e password sono obbligatori' });
      return;
    }
    const result = await registerUser({ name, surname, email, password, phone, universityId, courseOfStudy });

    setRefreshCookie(res, result.refreshToken);
    trackUserToken(result.user.id, result.refreshToken).catch(() => {});

    logSecurityEvent('REGISTER', { userId: result.user.id });
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

    setRefreshCookie(res, result.refreshToken);
    trackUserToken(result.user.id, result.refreshToken).catch(() => {});

    logSecurityEvent('LOGIN_SUCCESS', { userId: result.user.id });

    trackLoginStreak(result.user.id).catch(() => {});

    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (err: any) {
    logSecurityEvent('LOGIN_FAILED', { ip: req.ip });
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

    // Check if token is blacklisted
    if (await isTokenBlacklisted(token)) {
      res.clearCookie('refreshToken', { path: '/api/auth' });
      res.status(401).json({ error: 'Token revocato' });
      return;
    }

    const payload = verifyRefreshToken(token);
    const accessToken = generateAccessToken({ userId: payload.userId, email: payload.email, role: payload.role });
    const newRefreshToken = generateRefreshToken({ userId: payload.userId, email: payload.email, role: payload.role });

    // Blacklist old refresh token, track new one
    blacklistToken(token, 7 * 24 * 60 * 60).catch(() => {});
    trackUserToken(payload.userId, newRefreshToken).catch(() => {});

    setRefreshCookie(res, newRefreshToken);

    logSecurityEvent('TOKEN_REFRESH', { userId: payload.userId });
    res.json({ accessToken });
  } catch (err) {
    logger.error('Refresh token verification failed');
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(401).json({ error: 'Token non valido' });
  }
}

export async function verifyEmailHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Non autenticato' });
      return;
    }
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Codice obbligatorio' });
      return;
    }
    const result = await verifyEmail(userId, code);
    logSecurityEvent('EMAIL_VERIFIED', { userId });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function resendOTPHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Non autenticato' });
      return;
    }
    const result = await resendVerificationCode(userId);
    res.json(result);
  } catch (err: any) {
    res.status(429).json({ error: err.message });
  }
}

export async function forgotPasswordHandler(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email obbligatoria' });
      return;
    }
    const result = await forgotPassword(email);
    logSecurityEvent('PASSWORD_RESET_REQUEST', {});
    res.json(result);
  } catch (err: any) {
    res.json({ message: 'Se l\'email è registrata, riceverai un codice di reset' });
  }
}

export async function resetPasswordHandler(req: Request, res: Response) {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: 'Email, codice e nuova password sono obbligatori' });
      return;
    }
    const result = await resetPassword(email, code, newPassword);
    logSecurityEvent('PASSWORD_RESET_SUCCESS', {});
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function googleAuthHandler(req: Request, res: Response) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ error: 'Token Google mancante' });
      return;
    }
    const result = await googleAuth(idToken);

    setRefreshCookie(res, result.refreshToken);
    trackUserToken(result.user.id, result.refreshToken).catch(() => {});

    logSecurityEvent('GOOGLE_AUTH', { userId: result.user.id });

    trackLoginStreak(result.user.id).catch(() => {});

    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (err: any) {
    logger.error('Google auth failed');
    res.status(401).json({ error: err.message });
  }
}

export async function changePasswordHandler(req: Request, res: Response) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      res.status(400).json({ error: 'Campi obbligatori mancanti' });
      return;
    }
    await changePassword(req.user!.userId, oldPassword, newPassword);

    // Invalidate all existing refresh tokens for this user
    invalidateAllUserTokens(req.user!.userId).catch(() => {});

    res.json({ message: 'Password aggiornata con successo' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
