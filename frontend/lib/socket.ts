import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL && window.location.hostname !== 'localhost') {
  console.warn('NEXT_PUBLIC_API_URL is not set - using localhost fallback');
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('accessToken');
    socket = io(`${API_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
