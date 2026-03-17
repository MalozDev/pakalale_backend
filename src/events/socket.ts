import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import jwt from 'jsonwebtoken';

let io: SocketIOServer;

// We maintain a mapping of userId -> socketId so we know exactly
// who to send real-time events to.
const userSockets = new Map<string, string>();

export const initSocket = (server: Server) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*', // For development. Update in production.
      methods: ['GET', 'POST']
    }
  });

  // Authentication Middleware for Socket.IO
  // Ensures only logged in users can connect to our real-time feeds
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
      // Attach the verified user ID to the socket
      socket.data.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    console.log(`User Connected to Socket: ${userId}`);

    // Map this user to their active socket ID
    userSockets.set(userId, socket.id);

    // Optional: a user can manually join a specific conversation room for typing indicators
    socket.on('join_conversation', (conversationId) => {
      socket.join(conversationId);
      console.log(`User ${userId} joined room ${conversationId}`);
    });

    socket.on('disconnect', () => {
      console.log(`User Disconnected: ${userId}`);
      userSockets.delete(userId);
    });
  });

  return io;
};

// Helper function to push real-time events to a specific user
export const sendToUser = (userId: string, event: string, payload: any) => {
  if (!io) {
    console.error('Socket.io is not initialized');
    return;
  }

  const socketId = userSockets.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, payload);
  }
};
