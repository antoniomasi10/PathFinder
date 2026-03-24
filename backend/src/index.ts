import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import opportunityRoutes from './routes/opportunity.routes';
import universityRoutes from './routes/university.routes';
import postRoutes from './routes/post.routes';
import friendRoutes from './routes/friend.routes';
import notificationRoutes from './routes/notification.routes';
import messageRoutes from './routes/message.routes';
import groupRoutes from './routes/group.routes';
import userRoutes from './routes/user.routes';
import courseRoutes from './routes/course.routes';
import badgeRoutes from './routes/badge.routes';
import importRoutes from './routes/import.routes';
import { setupChatSocket } from './socket/chatHandler';
import { logger } from './utils/logger';
import { setupNotificationSocket } from './socket/notificationHandler';
import { setIO } from './socketManager';
import { startDeadlineChecker } from './services/deadlineChecker';
import { startImportScheduler } from './services/import/scheduler';

const FRONTEND_URL = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL must be set in production');
}

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
  },
  maxHttpBufferSize: 5e6, // 5MB per supportare invio immagini via socket
});

app.use(helmet());
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));

// General rate limit: 1000 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/auth'), // auth has its own limiter
});
app.use(limiter);

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// Auth rate limiter: login/register only (not refresh/logout)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Troppi tentativi, riprova più tardi' },
  skip: (req) => ['/refresh', '/logout', '/verify-email', '/resend-otp'].includes(req.path),
});
app.use('/api/auth', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/universities', universityRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/import', importRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Socket.IO
setIO(io);
setupChatSocket(io);
setupNotificationSocket(io);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  startDeadlineChecker();
  startImportScheduler();
});

export { io };
