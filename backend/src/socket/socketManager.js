const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config/jwt');
const { getRedis } = require('../config/redis');
// Cliente global a propósito SOLO en el arranque del socket (todavía no hay empresa en el contexto).
// Todo lo que sigue se ejecuta con `conEmpresa(...)` y usa el cliente con alcance.
const { prisma, prismaGlobal } = require('../config/database');
const { conEmpresa } = require('../config/tenant');
const { ROLES } = require('../constants/roles');
const { ESTADO_USUARIO, ESTADO_TURNO, ESTADO_EMPRESA } = require('../constants/estados');
const { salaInstalacion, salaEmpresa, salaCentral, salaAdmin } = require('../constants/salas');
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
      const user = await prismaGlobal.usuario.findUnique({ where: { id: decoded.id },
        select: { id: true, rol: true, estado: true, instalacion_asignada_id: true, empresa_id: true, empresa: { select: { estado: true } } },
      });
      if (!user || user.estado !== ESTADO_USUARIO.ACTIVO || user.rol !== decoded.rol) throw new Error('Usuario inválido');
      // El nivel de plataforma (super admin) no recibe eventos operativos: no tiene empresa.
      // La empresa debe coincidir con la del token y estar activa.
      if (!user.empresa_id || user.empresa_id !== decoded.empresaId) throw new Error('Empresa inválida');
      if (user.empresa?.estado !== ESTADO_EMPRESA.ACTIVA) throw new Error('Empresa suspendida');
      socket.data.user = user;
      socket.data.empresaId = user.empresa_id;
      socket.data.global = [ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR].includes(user.rol);
      let ids = [];
      // Las consultas de instalaciones/turnos corren dentro del contexto de la empresa del usuario.
      await conEmpresa(user.empresa_id, async () => {
        if (user.rol === ROLES.SUPERVISOR) ids = await resolverInstalacionesSupervisor(user);
        else if ([ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE].includes(user.rol)) {
          const ventana = turnosDeHoy();
          const turnos = await prisma.turno.findMany({ where: {
            usuario_id: user.id, ...ventana.where, estado: { not: ESTADO_TURNO.CANCELADO },
          } });
          ids = turnos.filter(ventana.incluir).map(t => t.instalacion_id);
          if (user.instalacion_asignada_id) ids.push(user.instalacion_asignada_id);
        } else if (!socket.data.global) throw new Error('Rol inválido');
      });
      socket.data.instalaciones = new Set(ids);
      next();
    } catch (_) { next(new Error('No autorizado')); }
  });

  io.on('connection', (socket) => {
    const { user, instalaciones, global, empresaId } = socket.data;
    socket.join(salaEmpresa(empresaId));
    if (user.rol === ROLES.OPERADOR_CENTRAL) socket.join(salaCentral(empresaId));
    if (user.rol === ROLES.ADMINISTRADOR) socket.join(salaAdmin(empresaId));
    for (const id of instalaciones) socket.join(salaInstalacion(id));
    console.log(`[SOCKET] Nuevo cliente conectado: ${socket.id}`);

    // El cliente solicita unirse a la sala de una instalación concreta.
    // Esto permite que los eventos 'novedad:nueva' lleguen solo a los
    // supervisores/guardias de esa instalación. Central y Administración pueden unirse a cualquiera
    // de SU empresa; nunca a la de otra (se valida contra la base, con el alcance de la empresa).
    socket.on('join:instalacion', async (instalacionId, ack) => {
      let permitido = false;
      try {
        if (typeof instalacionId === 'string' && instalacionId) {
          permitido = instalaciones.has(instalacionId)
            || (global && !!(await conEmpresa(empresaId, () => prisma.instalacion.findUnique({ where: { id: instalacionId }, select: { id: true } }))));
        }
      } catch (_) { permitido = false; }
      if (permitido) {
        socket.join(salaInstalacion(instalacionId));
        console.log(`[SOCKET] ${socket.id} unido a instalacion:${instalacionId}`);
      }
      if (typeof ack === 'function') ack({ ok: permitido });
    });

    socket.on('leave:instalacion', (instalacionId) => {
      if (instalacionId) {
        socket.leave(salaInstalacion(instalacionId));
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

/** Desconecta a todos los sockets de una empresa (al suspenderla). Un socket nuevo ya no podrá conectarse. */
const desconectarEmpresa = (empresaId) => {
  if (!io) return;
  io.in(salaEmpresa(empresaId)).disconnectSockets(true);
};

module.exports = {
  initSocket,
  getSocketIO,
  desconectarEmpresa,
};
