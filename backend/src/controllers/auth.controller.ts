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

function setRefreshCookie(res: Response, token: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: true,
    sameSite: isProduction ? 'none' : 'strict', // 'none' needed for cross-origin (Vercel ↔ VPS)
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

export async function register(req: Request, res: Response) {
  try {
    const { name, surname, username, email, password, phone, universityId, courseOfStudy } = req.body;
    if (!name || !surname || !username || !email || !password) {
      res.status(400).json({ error: 'Nome, cognome, username, email e password sono obbligatori' });
      return;
    }
    const result = await registerUser({ name, surname, username, email, password, phone, universityId, courseOfStudy });

    setRefreshCookie(res, result.refreshToken);

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

    setRefreshCookie(res, result.refreshToken);

    logSecurityEvent('LOGIN_SUCCESS', { userId: result.user.id, email });

    // Track login streak (fire and forget)
    trackLoginStreak(result.user.id).catch(() => {});

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

    setRefreshCookie(res, newRefreshToken);

    logSecurityEvent('TOKEN_REFRESH', { userId: payload.userId });
    res.json({ accessToken });
  } catch (err) {
    logger.error('Refresh token verification failed', { error: String(err) });
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
    logSecurityEvent('PASSWORD_RESET_REQUEST', { email });
    res.json(result);
  } catch (err: any) {
    // Always return success to prevent email enumeration
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
    logSecurityEvent('PASSWORD_RESET_SUCCESS', { email });
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

    logSecurityEvent('GOOGLE_AUTH', { userId: result.user.id, email: result.user.email });

    // Track login streak (fire and forget)
    trackLoginStreak(result.user.id).catch(() => {});

    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (err: any) {
    logger.error('Google auth failed', { error: String(err) });
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
    res.json({ message: 'Password aggiornata con successo' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

