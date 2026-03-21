import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';

export function setupNotificationSocket(io: Server) {
  const notifNs = io.of('/notifications');

  notifNs.use((socket, next) => {
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

  notifNs.on('connection', (socket) => {
    const userId = (socket as any).userId;
    socket.join(`user:${userId}`);

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
    });
  });
}
