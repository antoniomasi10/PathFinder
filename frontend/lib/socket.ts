import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL && window.location.hostname !== 'localhost') {
  console.warn('NEXT_PUBLIC_API_URL is not set - using localhost fallback');
}

let socket: Socket | null = null;
let notificationSocket: Socket | null = null;

/**
 * Re-authenticate all active sockets with a fresh token.
 * Call this after a token refresh (e.g., from the Axios 401 interceptor).
 */
export function reauthenticateSockets() {
  const token = getAccessToken();
  if (!token) return;
  if (socket?.connected) {
    socket.emit('socket_reauthenticate', { token });
  }
  if (notificationSocket?.connected) {
    notificationSocket.emit('socket_reauthenticate', { token });
  }
}

export function getSocket(): Socket {
  if (!socket) {
    const token = getAccessToken();
    socket = io(`${API_URL}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    // Refresh token on each reconnect attempt so we never use an expired JWT
    socket.on('reconnect_attempt', () => {
      if (socket) {
        socket.auth = { token: getAccessToken() };
      }
    });
  }
  return socket;
}

export function getNotificationSocket(): Socket {
  if (!notificationSocket) {
    const token = getAccessToken();
    notificationSocket = io(`${API_URL}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    notificationSocket.on('reconnect_attempt', () => {
      if (notificationSocket) {
        notificationSocket.auth = { token: getAccessToken() };
      }
    });
  }
  return notificationSocket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function disconnectNotificationSocket() {
  if (notificationSocket) {
    notificationSocket.disconnect();
    notificationSocket = null;
  }
}
