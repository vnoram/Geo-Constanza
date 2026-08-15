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
const { uploadFotoToAzure } = require('../utils/azureStorage');

// ============================================================================
// CONFIGURACIONES
// ============================================================================

const FILE_CONFIG = {
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
  MAX_SIZE_MB: 5,
  MAX_SIZE_BYTES: 5 * 1024 * 1024,
};

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
      if (fecha_inicio) where.created_at.gte = new Date(fecha_inicio);
      if (fecha_fin) where.created_at.lte = new Date(fecha_fin);
    }

    if (user.rol === 'pauta' || user.rol === 'libre') {
      where.usuario_id = user.id;
    } else if (user.rol === 'supervisor') {
      const ids = await resolverInstalacionesSupervisor(user);
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
      data,
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
        usuario: { select: { id: true, nombre: true, telefono: true } },
        instalacion: { select: { id: true, nombre: true } },
      },
    });

    if (user.rol === 'pauta' || user.rol === 'libre') {
      if (novedad.usuario_id !== user.id) {
        const error = new Error('No tienes permiso para ver esta novedad');
        error.statusCode = 403;
        throw error;
      }
    }

    return novedad;
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
  const { tipo, descripcion, latitud, longitud } = data;

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
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const turno = await prisma.turno.findFirst({
      where: { usuario_id: user.id, fecha: hoy, estado: { not: 'cancelado' } },
      include: { instalacion: true },
    });

    // GGSS libre: validar que tenga solicitud de turno aprobada para hoy
    if (!turno && user.rol === 'libre') {
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
      );
      gps_dentro_rango = geoResult.esValido;
    }

    // ── Urgencia ──────────────────────────────────────────────────
    const urgencia = priorizacion.evaluarUrgencia(tipo);

    // ── Foto (Azure) — MEJORADO: validación + manejo de errores ───
    let foto_url = null;
    if (file) {
      try {
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

    const novedad = await prisma.novedad.create({
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

    // ── Eventos WebSocket ─────────────────────────────────────────
    try {
      const io = getSocketIO();

      io.to(`instalacion:${turno.instalacion_id}`).emit('novedad:nueva', {
        id: novedad.id,
        tipo,
        urgencia,
        gps_dentro_rango,
        guardia: { id: user.id, nombre: user.nombre },
        instalacion_id: turno.instalacion_id,
        instalacion_nombre: turno.instalacion.nombre,
        created_at: novedad.created_at,
      });

      io.emit('admin:dashboard_update', { entity: 'novedad' });

      if (urgencia === 'rojo' && turno.instalacion.nivel_criticidad === 'Alta') {
        io.emit('alerta_critica_central', {
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

    return novedad;
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

const resolver = async (id, comentario, supervisorId) => {
  return prisma.novedad.update({
    where: { id },
    data: {
      estado: 'resuelta',
      comentario_cierre: comentario,
      atendida_por: supervisorId,
      fecha_atencion: new Date(),
    },
  });
};

const escalar = async (id, supervisorId) => {
  const novedad = await prisma.novedad.update({
    where: { id },
    data: { estado: 'escalada' },
  });

  try {
    const io = getSocketIO();
    io.emit('novedad:escalada', {
      id: novedad.id,
      tipo: novedad.tipo,
      urgencia: novedad.urgencia,
      instalacion: novedad.instalacion_id,
    });
  } catch (_) {}

  return novedad;
};

module.exports = { listar, obtenerPorId, crear, resolver, escalar, FILE_CONFIG };
