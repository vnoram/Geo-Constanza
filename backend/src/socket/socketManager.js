// src/socket/socketManager.js

let io;

const initSocket = (server) => {
  const { Server } = require('socket.io');
  const frontendOrigin = process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL || 'https://geo-constanza.vercel.app').replace(/\/$/, '')
    : true;

  io = new Server(server, {
    cors: {
      origin: frontendOrigin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Nuevo cliente conectado: ${socket.id}`);

    // El cliente solicita unirse a la sala de una instalación concreta.
    // Esto permite que los eventos 'novedad:nueva' lleguen solo a los
    // supervisores/guardias de esa instalación.
    socket.on('join:instalacion', (instalacionId) => {
      if (instalacionId) {
        socket.join(`instalacion:${instalacionId}`);
        console.log(`[SOCKET] ${socket.id} unido a instalacion:${instalacionId}`);
      }
    });

    socket.on('leave:instalacion', (instalacionId) => {
      if (instalacionId) {
        socket.leave(`instalacion:${instalacionId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
};

const getSocketIO = () => {
  if (!io) {
    throw new Error('Socket.io no ha sido inicializado!');
  }
  return io;
};

module.exports = {
  initSocket,
  getSocketIO,
};
