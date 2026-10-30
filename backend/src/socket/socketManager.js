const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config/jwt');
const { getRedis } = require('../config/redis');
const { prisma } = require('../config/database');
const { ROLES } = require('../constants/roles');
const { ESTADO_USUARIO, ESTADO_TURNO } = require('../constants/estados');
const { SALAS, salaInstalacion } = require('../constants/salas');
const { resolverInstalacionesSupervisor } = require('../services/supervisor.helper');
const { turnosDeHoy } = require('../utils/fechaChile');

let io;

const initSocket = (server) => {
  const { Server } = require('socket.io');
  const frontendOrigin = process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL || '').replace(/\/$/, '')
    : true;

  io = new Server(server, {
    cors: {
      origin: frontendOrigin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) throw new Error('Token requerido');
      const decoded = jwt.verify(token, jwtConfig.accessSecret);
      const redis = getRedis();
      if (redis && await redis.get(`bl:${token}`)) throw new Error('Token inválido');
      const user = await prisma.usuario.findUnique({ where: { id: decoded.id },
        select: { id: true, rol: true, estado: true, instalacion_asignada_id: true },
      });
      if (!user || user.estado !== ESTADO_USUARIO.ACTIVO || user.rol !== decoded.rol) throw new Error('Usuario inválido');
      socket.data.user = user;
      socket.data.global = [ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR].includes(user.rol);
      let ids = [];
      if (user.rol === ROLES.SUPERVISOR) ids = await resolverInstalacionesSupervisor(user);
      else if ([ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE].includes(user.rol)) {
        const ventana = turnosDeHoy();
        const turnos = await prisma.turno.findMany({ where: {
          usuario_id: user.id, ...ventana.where, estado: { not: ESTADO_TURNO.CANCELADO },
        } });
        ids = turnos.filter(ventana.incluir).map(t => t.instalacion_id);
        if (user.instalacion_asignada_id) ids.push(user.instalacion_asignada_id);
      } else if (!socket.data.global) throw new Error('Rol inválido');
      socket.data.instalaciones = new Set(ids);
      next();
    } catch (_) { next(new Error('No autorizado')); }
  });

  io.on('connection', (socket) => {
    const { user, instalaciones, global } = socket.data;
    if (user.rol === ROLES.OPERADOR_CENTRAL) socket.join(SALAS.CENTRAL);
    if (user.rol === ROLES.ADMINISTRADOR) socket.join(SALAS.ADMIN);
    for (const id of instalaciones) socket.join(salaInstalacion(id));
    console.log(`[SOCKET] Nuevo cliente conectado: ${socket.id}`);

    // El cliente solicita unirse a la sala de una instalación concreta.
    // Esto permite que los eventos 'novedad:nueva' lleguen solo a los
    // supervisores/guardias de esa instalación.
    socket.on('join:instalacion', (instalacionId, ack) => {
      const permitido = typeof instalacionId === 'string' && !!instalacionId && (global || instalaciones.has(instalacionId));
      if (permitido) {
        socket.join(`instalacion:${instalacionId}`);
        console.log(`[SOCKET] ${socket.id} unido a instalacion:${instalacionId}`);
      }
      if (typeof ack === 'function') ack({ ok: permitido });
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
