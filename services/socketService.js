const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

const init = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });

  // Middleware d'authentification Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: Token manquant'));
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error: Token invalide'));
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connecté: User ${socket.user.id}`);
    
    // Rejoindre une room personnelle
    socket.join(socket.user.id);
    
    // Rejoindre une room organisation
    if (socket.user.organizationId) {
      socket.join(`org_${socket.user.organizationId}`);
    }

    socket.on('disconnect', () => {});
  });

  return io;
};

const sendNotificationToUser = (userId, notification) => {
  if (io) {
    io.to(userId).emit('new_notification', notification);
  }
};

const sendNotificationToOrg = (orgId, notification) => {
  if (io) {
    io.to(`org_${orgId}`).emit('new_notification', notification);
  }
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = {
  init,
  getIo,
  sendNotificationToUser,
  sendNotificationToOrg
};
