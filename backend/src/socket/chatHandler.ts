import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import prisma from '../lib/prisma';

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
    } catch {
      next(new Error('Token non valido'));
    }
  });

  chatNs.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    socket.join(`user:${userId}`);

    socket.on('send_message', async (data: { receiverId: string; content: string }) => {
      try {
        const message = await prisma.pathMatesMessage.create({
          data: {
            senderId: userId,
            receiverId: data.receiverId,
            content: data.content,
          },
          include: {
            sender: { select: { id: true, name: true, avatar: true } },
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
