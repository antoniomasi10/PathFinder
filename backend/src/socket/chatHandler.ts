import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import prisma from '../lib/prisma';
import { validateImages } from '../utils/imageValidation';
import { logger } from '../utils/logger';

const messageRateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_MESSAGES_PER_MINUTE = 30;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = messageRateLimits.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    messageRateLimits.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (userLimit.count >= MAX_MESSAGES_PER_MINUTE) {
    return false;
  }

  userLimit.count++;
  return true;
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

    socket.on('send_group_message', async (data: { groupId: string; content: string; images?: string[] }) => {
      if (!checkRateLimit(userId)) {
        socket.emit('error', { message: 'Troppi messaggi, riprova tra poco' });
        return;
      }
      try {
        // Verify membership
        const membership = await prisma.groupMember.findUnique({
          where: { groupId_userId: { groupId: data.groupId, userId } },
        });
        if (!membership) {
          socket.emit('error', { message: 'Non sei membro di questo gruppo' });
          return;
        }

        const validImages = validateImages(data.images);
        const message = await prisma.pathMatesMessage.create({
          data: {
            senderId: userId,
            groupId: data.groupId,
            content: data.content,
            images: validImages,
          },
          include: {
            sender: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
          },
        });

        // Send to all group members except sender
        socket.to(`group:${data.groupId}`).emit('new_group_message', message);
        // Confirm to sender
        socket.emit('group_message_sent', message);
      } catch (err) {
        socket.emit('error', { message: 'Errore nell\'invio del messaggio di gruppo' });
      }
    });

    socket.on('send_message', async (data: { receiverId: string; content: string; images?: string[] }) => {
      if (!checkRateLimit(userId)) {
        socket.emit('error', { message: 'Troppi messaggi, riprova tra poco' });
        return;
      }
      try {
        // Check receiver's messagePrivacy
        const receiver = await prisma.user.findUnique({
          where: { id: data.receiverId },
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
                { fromUserId: userId, toUserId: data.receiverId },
                { fromUserId: data.receiverId, toUserId: userId },
              ],
            },
          });
          if (!friendship) {
            socket.emit('message_error', { message: 'Solo i Pathmates possono inviare messaggi a questo utente' });
            return;
          }
        }

        const message = await prisma.pathMatesMessage.create({
          data: {
            senderId: userId,
            receiverId: data.receiverId,
            content: data.content,
            images: validImages,
          },
          include: {
            sender: { select: { id: true, name: true, avatar: true, avatarBgColor: true } },
          },
        });

        // Send to receiver
        chatNs.to(`user:${data.receiverId}`).emit('new_message', message);
        // Send back to sender for confirmation
        socket.emit('message_sent', message);
      } catch (err) {
        socket.emit('error', { message: 'Errore nell\'invio del messaggio' });
      }
    });

    socket.on('typing', (data: { receiverId: string }) => {
      chatNs.to(`user:${data.receiverId}`).emit('user_typing', { userId });
    });

    socket.on('stop_typing', (data: { receiverId: string }) => {
      chatNs.to(`user:${data.receiverId}`).emit('user_stop_typing', { userId });
    });

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
    });
  });
}
