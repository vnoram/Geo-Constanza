// src/socket/socketManager.js

let io;

const initSocket = (server) => {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: '*', // Configura esto según tus necesidades de CORS
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Nuevo cliente conectado: ${socket.id}`);

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
  getSocketIO
};
