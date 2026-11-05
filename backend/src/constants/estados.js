/**
 * Estados usados por los distintos modelos del dominio.
 * Agrupados por entidad porque cada una maneja su propio ciclo de vida
 * (no son intercambiables entre sí).
 */

const ESTADO_NOVEDAD = {
  ABIERTA: 'abierta',
  EN_ATENCION: 'en_atencion',
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

const ESTADO_EMPRESA = {
  ACTIVA: 'activa',
  SUSPENDIDA: 'suspendida',
};

const PLANES_EMPRESA = ['basico', 'estandar', 'premium'];

// Empresa que recibe los datos existentes al migrar a multiempresa (ver migración multiempresa_aditiva)
const EMPRESA_POR_DEFECTO_ID = '00000000-0000-4000-8000-000000000001';

module.exports = {
  ESTADO_NOVEDAD,
  ESTADO_TURNO,
  ESTADO_ASISTENCIA,
  ESTADO_SOLICITUD,
  ESTADO_USUARIO,
  ESTADO_EMPRESA,
  PLANES_EMPRESA,
  EMPRESA_POR_DEFECTO_ID,
};
