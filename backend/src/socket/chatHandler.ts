import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { validateImages } from '../utils/imageValidation';
import { uploadImages } from '../utils/imageUpload';
import { logger } from '../utils/logger';
import { sanitizeText } from '../utils/sanitize';
import { z } from 'zod';

const MAX_MESSAGES_PER_MINUTE = 30;
const MAX_CONNECTIONS_PER_USER = 5;
const MAX_CONNECTIONS_PER_IP_PER_MINUTE = 20;

// Zod schemas for socket message validation
const groupMessageSchema = z.object({
  groupId: z.string().uuid(),
  content: z.string().max(5000),
  images: z.array(z.string()).max(5).optional(),
}).refine((d) => d.content.trim().length > 0 || (d.images && d.images.length > 0), {
  message: 'Messaggio o immagine obbligatori',
});

const directMessageSchema = z.union([
  z.object({
    receiverId: z.string().uuid(),
    type: z.undefined().or(z.literal('text')),
    content: z.string().max(5000),
    images: z.array(z.string()).max(5).optional(),
  }).refine((d) => d.content.trim().length > 0 || (d.images && d.images.length > 0), {
    message: 'Messaggio o immagine obbligatori',
  }),
  z.object({
    receiverId: z.string().uuid(),
    type: z.literal('opportunity'),
    opportunityId: z.string().uuid(),
    content: z.string().optional(),
    images: z.array(z.string()).max(5).optional(),
  }),
]);

async function checkRateLimit(userId: string): Promise<boolean> {
  try {
    const key = `ratelimit:chat:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }
    return count <= MAX_MESSAGES_PER_MINUTE;
  } catch {
    return true;
  }
}

async function checkConnectionLimit(userId: string, ip: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Check per-user connection limit
    const userKey = `socket:conn:user:${userId}`;
    const userConns = await redis.incr(userKey);
    if (userConns === 1) await redis.expire(userKey, 300); // 5 min TTL
    if (userConns > MAX_CONNECTIONS_PER_USER) {
      await redis.decr(userKey);
      return { allowed: false, reason: 'Troppe connessioni simultanee' };
    }

    // Check per-IP connection rate limit
    const ipKey = `socket:conn:ip:${ip}`;
    const ipConns = await redis.incr(ipKey);
    if (ipConns === 1) await redis.expire(ipKey, 60);
    if (ipConns > MAX_CONNECTIONS_PER_IP_PER_MINUTE) {
      await redis.decr(userKey);
      await redis.decr(ipKey);
      return { allowed: false, reason: 'Troppe connessioni da questo indirizzo' };
    }

    return { allowed: true };
  } catch {
    return { allowed: true }; // Fail-open if Redis down
  }
}

async function decrementConnectionCount(userId: string, ip: string) {
  try {
    await redis.decr(`socket:conn:user:${userId}`);
    // Don't decrement IP — it's a rate counter, not a gauge
  } catch { /* ignore */ }
}

export function setupChatSocket(io: Server) {
  const chatNs = io.of('/chat');

  chatNs.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Autenticazione richiesta'));
    }
    try {
      const payload = verifyAccessToken(token);
      (socket as any).userId = payload.userId;
      next();
    } catch (err) {
      logger.error('Socket auth token verification failed', { error: String(err) });
      next(new Error('Token non valido'));
    }
  });

  chatNs.on('connection', async (socket: Socket) => {
    const userId = (socket as any).userId;
    const ip = socket.handshake.address;

    // Connection rate limiting
    const connCheck = await checkConnectionLimit(userId, ip);
    if (!connCheck.allowed) {
      socket.emit('error', { message: connCheck.reason, code: 'connection_limit_exceeded' });
      socket.disconnect(true);
      return;
    }

    socket.join(`user:${userId}`);

    // Join all group rooms
    try {
      const memberships = await prisma.groupMember.findMany({
        where: { userId },
        select: { groupId: true },
      });
      for (const m of memberships) {
        socket.join(`group:${m.groupId}`);
      }
    } catch (err) { logger.error('Failed to join group rooms', { error: String(err) }); }

    // Re-authentication handler for token refresh
    socket.on('socket_reauthenticate', (data: { token: string }) => {
      try {
        const payload = verifyAccessToken(data.token);
        (socket as any).userId = payload.userId;
        socket.emit('reauthenticated');
      } catch {
        socket.emit('error', { message: 'Token non valido', code: 'auth_failed' });
        socket.disconnect(true);
      }
    });

    socket.on('send_group_message', async (data: unknown) => {
      // Validate input with Zod
      const parsed = groupMessageSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit('group_message_error', { message: 'Dati messaggio non validi' });
        return;
      }
      const { groupId, content, images } = parsed.data;

      if (!(await checkRateLimit(userId))) {
        socket.emit('group_message_error', { message: 'Troppi messaggi, riprova tra poco' });
        return;
      }
      try {
        const membership = await prisma.groupMember.findUnique({
          where: { groupId_userId: { groupId, userId } },
        });
        if (!membership) {
          socket.emit('group_message_error', { message: 'Non sei membro di questo gruppo' });
          return;
        }

        const validImages = validateImages(images);
        const imageUrls = await uploadImages(validImages, 'messages');
        const message = await prisma.pathMatesMessage.create({
          data: {
            senderId: userId,
            groupId,
            content: sanitizeText(content),
            images: imageUrls,
          },
          include: {
            sender: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
          },
        });

        socket.to(`group:${groupId}`).emit('new_group_message', message);
        socket.emit('group_message_sent', message);
      } catch (err) {
        logger.error('send_group_message failed', { error: String(err) });
        socket.emit('group_message_error', { message: 'Errore nell\'invio del messaggio di gruppo' });
      }
    });

    socket.on('send_message', async (data: unknown) => {
      // Validate input with Zod
      const parsed = directMessageSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit('message_error', { message: 'Dati messaggio non validi' });
        return;
      }
      const msg = parsed.data as any;
      const { receiverId, images } = msg;
      const msgType: 'text' | 'opportunity' = msg.type === 'opportunity' ? 'opportunity' : 'text';
      const content: string = msgType === 'opportunity' ? '' : (msg.content || '');
      const opportunityId: string | undefined = msgType === 'opportunity' ? msg.opportunityId : undefined;

      if (!(await checkRateLimit(userId))) {
        socket.emit('message_error', { message: 'Troppi messaggi, riprova tra poco' });
        return;
      }
      try {
        const receiver = await prisma.user.findUnique({
          where: { id: receiverId },
          select: { messagePrivacy: true },
        });
        if (!receiver) {
          socket.emit('message_error', { message: 'Utente non trovato' });
          return;
        }
        if (receiver.messagePrivacy === 'Nessuno') {
          socket.emit('message_error', { message: 'Questo utente non accetta messaggi' });
          return;
        }
        if (receiver.messagePrivacy === 'Pathmates') {
          const friendship = await prisma.friendRequest.findFirst({
            where: {
              status: 'ACCEPTED',
              OR: [
                { fromUserId: userId, toUserId: receiverId },
                { fromUserId: receiverId, toUserId: userId },
              ],
            },
          });
          if (!friendship) {
            socket.emit('message_error', { message: 'Solo i Pathmates possono inviare messaggi a questo utente' });
            return;
          }
        }

        const validImages = validateImages(images);
        const imageUrls = await uploadImages(validImages, 'messages');
        const message = await prisma.pathMatesMessage.create({
          data: {
            senderId: userId,
            receiverId,
            content: msgType === 'opportunity' ? '' : sanitizeText(content || ''),
            images: imageUrls,
            type: msgType === 'opportunity' ? 'OPPORTUNITY' : 'TEXT',
            ...(opportunityId ? { opportunityId } : {}),
          },
          include: {
            sender: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
          },
        });

        chatNs.to(`user:${receiverId}`).emit('new_message', message);
        socket.emit('message_sent', message);
      } catch (err) {
        logger.error('send_message failed', { error: String(err) });
        socket.emit('message_error', { message: 'Errore nell\'invio del messaggio' });
      }
    });

    socket.on('typing', (data: { receiverId: string }) => {
      chatNs.to(`user:${data.receiverId}`).emit('user_typing', { userId });
    });

    socket.on('stop_typing', (data: { receiverId: string }) => {
      chatNs.to(`user:${data.receiverId}`).emit('user_stop_typing', { userId });
    });

    socket.on('disconnect', () => {
      decrementConnectionCount(userId, ip);
      socket.leave(`user:${userId}`);
    });
  });
}
