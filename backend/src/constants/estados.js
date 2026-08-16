/**
 * Estados usados por los distintos modelos del dominio.
 * Agrupados por entidad porque cada una maneja su propio ciclo de vida
 * (no son intercambiables entre sí).
 */

const ESTADO_NOVEDAD = {
  ABIERTA: 'abierta',
  RESUELTA: 'resuelta',
  ESCALADA: 'escalada',
};

const ESTADO_TURNO = {
  PROGRAMADO: 'programado',
  CANCELADO: 'cancelado',
};

const ESTADO_ASISTENCIA = {
  NORMAL: 'normal',
  TARDIO: 'tardio',
};

const ESTADO_SOLICITUD = {
  PENDIENTE: 'pendiente',
  APROBADA: 'aprobada',
  RECHAZADA: 'rechazada',
};

const ESTADO_USUARIO = {
  ACTIVO: 'activo',
  INACTIVO: 'inactivo',
};

module.exports = {
  ESTADO_NOVEDAD,
  ESTADO_TURNO,
  ESTADO_ASISTENCIA,
  ESTADO_SOLICITUD,
  ESTADO_USUARIO,
};
