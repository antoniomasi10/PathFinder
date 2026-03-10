import { Router } from 'express';
import { register, login, refresh, changePasswordHandler, forgotPasswordHandler, resetPasswordHandler } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);

// Password management
router.post('/change-password', authMiddleware, changePasswordHandler);
router.post('/forgot-password', authMiddleware, forgotPasswordHandler);
router.post('/reset-password', resetPasswordHandler);

export default router;
