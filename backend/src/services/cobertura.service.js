const { prisma } = require('../config/database');
const politica = require('../constants/cobertura');
const { ROLES } = require('../constants/roles');
const { ESTADO_SOLICITUD, ESTADO_USUARIO, ESTADO_TURNO } = require('../constants/estados');
const { ahoraChile, aFechaDB, sumarDias, instanteChile, intervaloTurno } = require('../utils/fechaChile');
const { verificarConflictos } = require('./turnos.service');
const { esVacante } = require('./vacantes.service');
const { resolverInstalacionesSupervisor } = require('./supervisor.helper');

const validarHoras = async (turno, usuarioId, db) => {
  const maximo = politica.MAX_HORAS_SEMANALES;
  if (!Number.isFinite(maximo) || maximo <= 0) {
    throw Object.assign(new Error('Falta configurar el máximo de horas semanales acordado para cobertura.'), { statusCode: 503 });
  }
  const intervalo = intervaloTurno(turno);
  const fecha = ahoraChile(intervalo.inicio).fecha;
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  let lunes = sumarDias(fecha, -((dia + 6) % 7));
  // Se comprueba cada semana ISO que cruza el turno, en hora chilena.
  while (instanteChile(lunes, '00:00') < intervalo.fin) {
    const siguiente = sumarDias(lunes, 7);
    const inicio = instanteChile(lunes, '00:00'), fin = instanteChile(siguiente, '00:00');
    const planificados = await db.turno.findMany({ where: { usuario_id: usuarioId, id: { not: turno.id },
      estado: { not: ESTADO_TURNO.CANCELADO }, fecha: { gte: aFechaDB(sumarDias(lunes, -1)), lt: aFechaDB(siguiente) },
    } });
    const horas = [...planificados, turno].reduce((total, t) => {
      const i = intervaloTurno(t);
      return total + Math.max(0, Math.min(i.fin, fin) - Math.max(i.inicio, inicio)) / 3600000;
    }, 0);
    if (horas > maximo) throw Object.assign(new Error('La cobertura excede el máximo de horas semanales configurado.'), { statusCode: 409 });
    lunes = siguiente;
  }
};

const aprobarCobertura = async (id, revisorId, comentario) => {
  try {
    return await prisma.$transaction(async tx => {
      const solicitud = await tx.solicitud.findUniqueOrThrow({ where: { id } });
      if (solicitud.estado !== ESTADO_SOLICITUD.PENDIENTE) throw Object.assign(new Error('La solicitud ya fue revisada.'), { statusCode: 409 });
      const turno = await tx.turno.findUnique({ where: { id: solicitud.vacante_turno_id },
        include: { instalacion: true, asistencias: { select: { id: true } },
          solicitudes_cobertura: { where: { estado: ESTADO_SOLICITUD.APROBADA }, select: { id: true } },
        },
      });
      if (!turno || !esVacante(turno)) throw Object.assign(new Error('La vacante ya no está disponible.'), { statusCode: 409 });
      const revisor = await tx.usuario.findUnique({ where: { id: revisorId } });
      if (revisor?.estado !== ESTADO_USUARIO.ACTIVO || ![ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR].includes(revisor.rol)) {
        throw Object.assign(new Error('No tienes permiso para aprobar cobertura.'), { statusCode: 403 });
      }
      if (revisor.rol === ROLES.SUPERVISOR && !(await resolverInstalacionesSupervisor(revisor)).includes(turno.instalacion_id)) {
        throw Object.assign(new Error('La vacante no pertenece a tu instalación.'), { statusCode: 403 });
      }
      const guardia = await tx.usuario.findUnique({ where: { id: solicitud.usuario_id } });
      if (guardia?.rol !== ROLES.GGSS_LIBRE || guardia.estado !== ESTADO_USUARIO.ACTIVO) {
        throw Object.assign(new Error('El solicitante debe ser GGSS Libre activo.'), { statusCode: 409 });
      }
      if ((await verificarConflictos({ ...turno, usuario_id: guardia.id, excluirId: turno.id }, tx)).length) {
        throw Object.assign(new Error('La cobertura se superpone con otro turno.'), { statusCode: 409 });
      }
      await validarHoras(turno, guardia.id, tx);
      await tx.turno.update({ where: { id: turno.id, usuario_id: turno.usuario_id, estado: ESTADO_TURNO.PROGRAMADO }, data: { usuario_id: guardia.id } });
      return tx.solicitud.update({ where: { id, estado: ESTADO_SOLICITUD.PENDIENTE }, data: {
        estado: ESTADO_SOLICITUD.APROBADA, revisada_por: revisorId, comentario_revision: comentario || null,
      }, include: { usuario: { select: { id: true, nombre: true } }, revisor: { select: { id: true, nombre: true } } } });
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (['P2034', 'P2025'].includes(error.code)) throw Object.assign(new Error('La cobertura cambió mientras se aprobaba. Recarga e intenta de nuevo.'), { statusCode: 409 });
    throw error;
  }
};
module.exports = { aprobarCobertura, validarHoras };
