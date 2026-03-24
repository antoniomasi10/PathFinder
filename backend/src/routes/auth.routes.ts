import { Router, Request, Response } from 'express';
import {
  register,
  login,
  refresh,
  verifyEmailHandler,
  resendOTPHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  googleAuthHandler,
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
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
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

// Google OAuth
router.post('/google', googleAuthHandler);

export default router;
