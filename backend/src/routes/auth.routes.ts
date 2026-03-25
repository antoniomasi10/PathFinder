import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import {
  register,
  login,
  refresh,
  verifyEmailHandler,
  resendOTPHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  googleAuthHandler,
  changePasswordHandler,
} from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';
import { registerSchema, loginSchema, verifyEmailSchema, resetPasswordSchema, forgotPasswordSchema } from '../schemas';

const router = Router();

// Existing routes
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', (req: Request, res: Response) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: true,
    sameSite: isProduction ? 'none' : 'strict',
    path: '/api/auth',
  });
  res.json({ message: 'Logout effettuato' });
});

// Email verification (requires auth — user has token but email not verified yet)
router.post('/verify-email', authMiddleware, validate(verifyEmailSchema), verifyEmailHandler);
router.post('/resend-otp', authMiddleware, resendOTPHandler);

// Password reset (public)
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPasswordHandler);
router.post('/reset-password', validate(resetPasswordSchema), resetPasswordHandler);

// Username availability check (public)
router.get('/check-username', async (req: Request, res: Response) => {
  const username = req.query.username as string;
  if (!username || username.length < 3) {
    res.json({ available: false });
    return;
  }
  const existing = await prisma.user.findUnique({ where: { username } });
  res.json({ available: !existing });
});

// Google OAuth
router.post('/google', googleAuthHandler);

// Password management (authenticated)
router.post('/change-password', authMiddleware, changePasswordHandler);

export default router;
