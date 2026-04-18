// src/socket/socketManager.js

let io;

const initSocket = (server) => {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: '*',
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
