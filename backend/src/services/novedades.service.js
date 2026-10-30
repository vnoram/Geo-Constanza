/**
 * Servicio mejorado para gestión de novedades
 * Incluye: validaciones de archivo, manejo robusto de errores, logging
 */

const { prisma } = require('../config/database');
const { getSocketIO } = require('../socket/socketManager');
const { logger } = require('../config/logger');
const priorizacion = require('./priorizacion.service');
const geovalidacion = require('./geovalidacion.service');
const { resolverInstalacionesSupervisor } = require('./supervisor.helper');
const { uploadFotoToAzure, generarUrlLectura } = require('../utils/azureStorage');
const { ROLES } = require('../constants/roles');
const { ESTADO_NOVEDAD, ESTADO_USUARIO, ESTADO_TURNO } = require('../constants/estados');
const { URGENCIAS } = require('../constants/urgencias');
const { conFolio } = require('../utils/folioNovedad');
const { ACCION_NOVEDAD } = require('../constants/accionesNovedad');
const { SALAS } = require('../constants/salas');
const { enviarNotificacion } = require('./notificacion.service');
const { inicioDiaChile, finDiaChile, turnosDeHoy } = require('../utils/fechaChile');

// ============================================================================
// CONFIGURACIONES
// ============================================================================

const FILE_CONFIG = {
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
};

// Agrega `foto_url_firmada`: link temporal para ver la foto con el contenedor privado
const conFotoFirmada = async (novedad) => ({
  ...conFolio(novedad),
  foto_url_firmada: await generarUrlLectura(novedad.foto_url),
});

// ============================================================================
// FUNCIONES PÚBLICAS
// ============================================================================

/**
 * Lista novedades con filtros y paginación
 */
const listar = async (query, user) => {
  try {
    const {
      instalacion_id,
      tipo,
      urgencia,
      estado,
      fecha_inicio,
      fecha_fin,
      page = 1,
      limit = 50,
    } = query;

    const where = {};

    if (tipo) where.tipo = tipo;
    if (urgencia) where.urgencia = urgencia;
    if (estado) where.estado = estado;

    if (fecha_inicio || fecha_fin) {
      where.created_at = {};
      if (fecha_inicio) where.created_at.gte = inicioDiaChile(fecha_inicio);
      if (fecha_fin) where.created_at.lte = finDiaChile(fecha_fin);
    }

    if (user.rol === ROLES.GGSS_EN_PAUTA || user.rol === ROLES.GGSS_LIBRE) {
      where.usuario_id = user.id;
    } else if (user.rol === ROLES.SUPERVISOR) {
      const ids = await resolverInstalacionesSupervisor(user);
      if (instalacion_id && !ids.includes(instalacion_id)) {
        throw Object.assign(new Error('No tienes permiso para ver esta instalación.'), { statusCode: 403 });
      }
      where.instalacion_id = instalacion_id ? instalacion_id : { in: ids };
    } else if (instalacion_id) {
      where.instalacion_id = instalacion_id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [data, total] = await Promise.all([
      prisma.novedad.findMany({
        where,
        include: {
          responsable: { select: { id: true, nombre: true } },
          usuario: { select: { id: true, nombre: true } },
          instalacion: { select: { id: true, nombre: true } },
        },
        orderBy: [{ urgencia: 'asc' }, { created_at: 'desc' }],
        skip,
        take,
      }),
      prisma.novedad.count({ where }),
    ]);

    return {
      data: await Promise.all(data.map(conFotoFirmada)),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / take),
    };
  } catch (error) {
    logger.error('❌ Error listando novedades', {
      usuarioId: user.id,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Obtiene una novedad específica por ID
 */
const obtenerPorId = async (id, user) => {
  try {
    const novedad = await prisma.novedad.findUniqueOrThrow({
      where: { id },
      include: {
        responsable: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true, telefono: true } },
        instalacion: { select: { id: true, nombre: true } },
      },
    });

    if (user.rol === ROLES.GGSS_EN_PAUTA || user.rol === ROLES.GGSS_LIBRE) {
      if (novedad.usuario_id !== user.id) {
        const error = new Error('No tienes permiso para ver esta novedad');
        error.statusCode = 403;
        throw error;
      }
    }

    if (user.rol === ROLES.SUPERVISOR) {
      const ids = await resolverInstalacionesSupervisor(user);
      if (!ids.includes(novedad.instalacion_id)) {
        throw Object.assign(new Error('No tienes permiso para ver esta novedad.'), { statusCode: 403 });
      }
    }
    return conFotoFirmada(novedad);
  } catch (error) {
    logger.error('❌ Error obteniendo novedad', {
      novedadId: id,
      usuarioId: user.id,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Crea una novedad (con validaciones de archivo, geolocalización y urgencia)
 */
const crear = async (data, file, user) => {
  const { tipo, descripcion, latitud, longitud, precision_m } = data;

  try {
    if (!tipo) {
      const error = new Error('Tipo de novedad es requerido');
      error.statusCode = 400;
      throw error;
    }

    if (!descripcion) {
      const error = new Error('Descripción es requerida');
      error.statusCode = 400;
      throw error;
    }

    // Obtener turno activo del guardia
    // Hora Chile; incluye un turno nocturno de ayer que sigue en curso (tiene prioridad)
    const ventana = turnosDeHoy();
    const candidatos = await prisma.turno.findMany({
      where: { usuario_id: user.id, ...ventana.where, estado: { not: ESTADO_TURNO.CANCELADO } },
      include: { instalacion: true },
      orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }],
    });
    const turno = candidatos.find(ventana.incluir) ?? null;

    // GGSS libre: validar que tenga solicitud de turno aprobada para hoy
    if (!turno && user.rol === ROLES.GGSS_LIBRE) {
      const { tieneturnoAprobadoHoy } = require('./solicitudes.service');
      const tieneAprobado = await tieneturnoAprobadoHoy(user.id);
      if (!tieneAprobado) {
        throw Object.assign(
          new Error('No tienes un turno aprobado para hoy. Solo puedes reportar novedades durante un turno activo.'),
          { statusCode: 403 },
        );
      }
    }

    if (!turno) {
      throw Object.assign(new Error('No tienes un turno activo para reportar novedades'), { statusCode: 400 });
    }

    // ── Validación geográfica ─────────────────────────────────────
    let gps_dentro_rango = null;
    const lat = parseFloat(latitud);
    const lon = parseFloat(longitud);
    if (!isNaN(lat) && !isNaN(lon)) {
      const geoResult = geovalidacion.validarAsistencia(
        lat,
        lon,
        turno.instalacion.latitud,
        turno.instalacion.longitud,
        turno.instalacion.radio_geofence_m,
        precision_m,
      );
      gps_dentro_rango = geoResult.esValido;
    }

    // ── Urgencia ──────────────────────────────────────────────────
    const urgencia = priorizacion.evaluarUrgencia(tipo);

    // ── Foto (Azure) — MEJORADO: validación + manejo de errores ───
    let foto_url = null;
    if (file) {
        // ✅ Validar tipo MIME
        if (!FILE_CONFIG.ALLOWED_TYPES.includes(file.mimetype)) {
          throw Object.assign(
            new Error('Tipo de archivo no permitido. Acepta: JPEG, PNG, WebP'),
            { statusCode: 400 },
          );
        }

        // ✅ Validar tamaño
        if (file.size > FILE_CONFIG.MAX_SIZE_BYTES) {
          throw Object.assign(
            new Error(`Archivo supera ${FILE_CONFIG.MAX_SIZE_MB}MB. Tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`),
            { statusCode: 413 },
          );
        }

      try {
        // ✅ Sanitizar nombre
        const ext = file.originalname.split('.').pop().toLowerCase();
        const safeFilename = `novedad-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

        foto_url = await uploadFotoToAzure(file.buffer, safeFilename, {
          usuarioId: user.id,
          tipo: 'novedad',
          mimetype: file.mimetype,
        });
      } catch (uploadError) {
        // No es crítico: la novedad se crea igual, sin foto
        logger.warn(`⚠️ No se pudo subir foto, continuando sin ella`, {
          usuarioId: user.id,
          error: uploadError.message,
        });
      }
    }

    const novedad = await prisma.$transaction(async (tx) => {
      const creada = await tx.novedad.create({
      data: {
        usuario_id: user.id,
        instalacion_id: turno.instalacion_id,
        turno_id: turno.id,
        tipo,
        descripcion,
        urgencia,
        foto_url,
        latitud: isNaN(lat) ? null : lat,
        longitud: isNaN(lon) ? null : lon,
        gps_dentro_rango,
      },
      });
      await tx.novedadHistorial.create({ data: {
        novedad_id: creada.id, usuario_id: user.id, accion: ACCION_NOVEDAD.CREAR,
        estado_anterior: null, estado_nuevo: ESTADO_NOVEDAD.ABIERTA,
      } });
      return creada;
    });

    // ── Eventos WebSocket ─────────────────────────────────────────
    try {
      const io = getSocketIO();

      const foto_url_firmada = await generarUrlLectura(foto_url);

      io.to(`instalacion:${turno.instalacion_id}`).emit('novedad:nueva', {
        id: novedad.id,
        folio: conFolio(novedad).folio,
        numero: novedad.numero,
        foto_url_firmada,
        tipo,
        urgencia,
        gps_dentro_rango,
        guardia: { id: user.id, nombre: user.nombre },
        instalacion_id: turno.instalacion_id,
        instalacion_nombre: turno.instalacion.nombre,
        created_at: novedad.created_at,
      });

      io.to([SALAS.ADMIN, SALAS.CENTRAL]).emit('admin:dashboard_update', { entity: 'novedad' });

      if (urgencia === URGENCIAS.ROJO && turno.instalacion.nivel_criticidad === 'Alta') {
        io.to(SALAS.CENTRAL).emit('alerta_critica_central', {
          id: novedad.id,
          tipo,
          urgencia,
          descripcion,
          gps_dentro_rango,
          guardia: { id: user.id, nombre: user.nombre },
          instalacion: {
            id: turno.instalacion_id,
            nombre: turno.instalacion.nombre,
            nivel_criticidad: turno.instalacion.nivel_criticidad,
          },
          created_at: novedad.created_at,
        });
      }
    } catch (_) {}

    return conFolio(novedad);
  } catch (error) {
    logger.error(`❌ Error creando novedad`, {
      usuarioId: user.id,
      tipo: data.tipo,
      error: error.message,
      statusCode: error.statusCode,
    });

    if (error.statusCode) throw error;

    const err = new Error(`Error al crear novedad: ${error.message}`);
    err.statusCode = 500;
    throw err;
  }
};

const exigirGestion = async (id, user, db = prisma) => {
  if (![ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR].includes(user?.rol)) {
    throw Object.assign(new Error('No tienes permiso para gestionar novedades.'), { statusCode: 403 });
  }
  const novedad = await db.novedad.findUnique({ where: { id } });
  if (!novedad) throw Object.assign(new Error('Novedad no encontrada.'), { statusCode: 404 });
  if (user.rol === ROLES.SUPERVISOR) {
    const ids = await resolverInstalacionesSupervisor(user);
    if (!ids.includes(novedad.instalacion_id)) {
      throw Object.assign(new Error('No tienes permiso para gestionar esta instalación.'), { statusCode: 403 });
    }
  }
  return novedad;
};

const resolver = async (id, comentario, user) => {
  if (typeof comentario !== 'string' || comentario.trim().length < 5) {
    throw Object.assign(new Error('El comentario de resolución debe tener al menos 5 caracteres.'), { statusCode: 400 });
  }

  return cambiarEstado(id, user, ACCION_NOVEDAD.RESOLVER, {
        estado: ESTADO_NOVEDAD.RESUELTA,
        comentario_cierre: comentario.trim(),
        atendida_por: user.id,
        fecha_atencion: new Date(),
  }, [ESTADO_NOVEDAD.ABIERTA, ESTADO_NOVEDAD.EN_ATENCION, ESTADO_NOVEDAD.ESCALADA], comentario.trim());
};

const escalar = async (id, user) => {
  const novedad = await cambiarEstado(id, user, ACCION_NOVEDAD.ESCALAR,
    { estado: ESTADO_NOVEDAD.ESCALADA }, [ESTADO_NOVEDAD.ABIERTA, ESTADO_NOVEDAD.EN_ATENCION]);

  try {
    const io = getSocketIO();
    io.to(`instalacion:${novedad.instalacion_id}`).emit('novedad:escalada', {
      id: novedad.id,
      tipo: novedad.tipo,
      urgencia: novedad.urgencia,
      instalacion: novedad.instalacion_id,
    });
  } catch (_) {}

  return novedad;
};

const responsables = async (id, user) => {
  await exigirGestion(id, user);
  return prisma.usuario.findMany({
    where: { rol: { in: [ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL] }, estado: ESTADO_USUARIO.ACTIVO },
    select: { id: true, nombre: true }, orderBy: { nombre: 'asc' },
  });
};

const asignar = async (id, responsableId, user) => {
  await exigirGestion(id, user);
  if (typeof responsableId !== 'string' || !responsableId.trim()) {
    throw Object.assign(new Error('Selecciona un responsable.'), { statusCode: 400 });
  }
  const responsable = await prisma.usuario.findUnique({ where: { id: responsableId } });
  if (!responsable || responsable.estado !== ESTADO_USUARIO.ACTIVO ||
      ![ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL].includes(responsable.rol)) {
    throw Object.assign(new Error('El responsable debe ser supervisor o central activo.'), { statusCode: 400 });
  }
  const novedad = await cambiarEstado(id, user, ACCION_NOVEDAD.ASIGNAR,
    { asignada_a: responsableId, estado: ESTADO_NOVEDAD.EN_ATENCION }, [ESTADO_NOVEDAD.ABIERTA]);
  try {
    getSocketIO().to(`instalacion:${novedad.instalacion_id}`).emit('novedad:asignada', novedad);
  } catch (_) {}
  await enviarNotificacion(responsableId, 'Novedad asignada', 'Se te ha asignado una novedad.', { novedad_id: id });
  return novedad;
};

const cambiarEstado = async (id, user, accion, data, permitidos, comentario = null) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const anterior = await exigirGestion(id, user, tx);
      if (!permitidos.includes(anterior.estado)) {
        throw Object.assign(new Error('La novedad no admite esta acción en su estado actual.'), { statusCode: 409 });
      }
      const novedad = await tx.novedad.update({
        where: { id, estado: anterior.estado }, data,
        include: { responsable: { select: { id: true, nombre: true } } },
      });
      await tx.novedadHistorial.create({ data: {
        novedad_id: id, usuario_id: user.id, accion, estado_anterior: anterior.estado,
        estado_nuevo: data.estado, comentario,
      } });
      return novedad;
    });
  } catch (error) {
    if (error.code !== 'P2025') throw error;
    const actual = await prisma.novedad.findUnique({ where: { id } });
    throw Object.assign(new Error(actual ? 'La novedad cambió de estado. Recarga e intenta de nuevo.' : 'Novedad no encontrada.'), { statusCode: actual ? 409 : 404 });
  }
};

const historial = async (id, user) => {
  await obtenerPorId(id, user);
  return prisma.novedadHistorial.findMany({ where: { novedad_id: id },
    include: { usuario: { select: { id: true, nombre: true } } },
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
  });
};

module.exports = { listar, obtenerPorId, crear, resolver, escalar, asignar, responsables, historial, FILE_CONFIG };
