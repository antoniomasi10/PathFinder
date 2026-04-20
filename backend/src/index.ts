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
import { createAdapter } from '@socket.io/redis-adapter';
import { createPubSubPair } from './lib/redis';
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
import skillRoutes from './routes/skills.routes';
import adminRoutes from './routes/admin.routes';
import { setupChatSocket } from './socket/chatHandler';
import { logger } from './utils/logger';
import { setupNotificationSocket } from './socket/notificationHandler';
import { correlationIdMiddleware } from './middleware/correlationId';
import { setIO } from './socketManager';
import { startDeadlineChecker } from './services/deadlineChecker';
import { startImportScheduler } from './services/import/scheduler';
import { bulkGenerateEmbeddings } from './services/embedding.service';

const FRONTEND_URL = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL must be set in production');
}

// Support multiple frontend origins (e.g. pathfinder-univ + pathfinder-italy on Vercel)
const ALLOWED_ORIGINS = [
  FRONTEND_URL,
  ...(process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(',') : []),
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:3001'] : []),
].filter(Boolean);

function corsOrigin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    callback(null, true);
  } else {
    callback(null, false);
  }
}

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
  maxHttpBufferSize: 5e6, // 5MB per supportare invio immagini via socket
});

app.set('trust proxy', 1); // trust first proxy (nginx/caddy)
app.use(helmet());
app.use(cors({
  origin: corsOrigin,
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
app.use(correlationIdMiddleware);

// Auth rate limiter: only applies to sensitive endpoints (login, register, password reset, OAuth)
// Excludes /refresh (called automatically by the frontend), /check-username (called on every keystroke),
// /logout, /verify-email, /change-password, /resend-otp (has its own limiter)
const SENSITIVE_AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/google'];
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Troppi tentativi, riprova più tardi' },
  skip: (req) => !SENSITIVE_AUTH_PATHS.includes(req.path),
});
app.use('/api/auth', authLimiter);

// Stricter rate limiter for OTP resend (max 3 per 15 min)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Troppi tentativi di invio OTP, riprova più tardi' },
});
app.use('/api/auth/resend-otp', otpLimiter);

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
app.use('/api/v1/users', skillRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Socket.IO — attach Redis adapter for horizontal scaling (multi-instance)
const { pub: pubClient, sub: subClient } = createPubSubPair();
const REDIS_ADAPTER_TIMEOUT = 5000;

Promise.race([
  Promise.all([
    new Promise<void>((resolve) => pubClient.on('ready', resolve)),
    new Promise<void>((resolve) => subClient.on('ready', resolve)),
  ]),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Redis connection timeout')), REDIS_ADAPTER_TIMEOUT),
  ),
]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  logger.info('Socket.IO Redis adapter connected');
}).catch((err) => {
  logger.warn('Redis adapter unavailable, falling back to in-memory adapter', { error: String(err) });
  pubClient.disconnect();
  subClient.disconnect();
});

setIO(io);
setupChatSocket(io);
setupNotificationSocket(io);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  startDeadlineChecker();
  startImportScheduler();
  // Backfill embeddings for records that don't have one yet (runs in background)
  bulkGenerateEmbeddings().catch((err) => {
    logger.error('Embedding backfill failed:', err);
  });
});

export { io };
