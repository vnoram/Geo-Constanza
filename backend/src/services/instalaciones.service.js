const { prisma } = require('../config/database');
const { ROLES } = require('../constants/roles');
const { resolverInstalacionesSupervisor, exigirAlcanceInstalacion } = require('./supervisor.helper');
const { TOLERANCIA_POR_DEFECTO_MINUTOS } = require('../constants/cobertura');
const { ESTADO_TURNO, ESTADO_NOVEDAD } = require('../constants/estados');
const { turnosDeHoy, intervaloTurno } = require('../utils/fechaChile');
const { SOLO_INCIDENCIAS } = require('./priorizacion.service');

const validarTolerancia = (valor) => {
  const numero = Number(valor);
  if (!['string', 'number'].includes(typeof valor) || valor === '' || !Number.isInteger(numero) || numero < 0 || numero > 2147483647) {
    throw Object.assign(new Error('La tolerancia debe ser un número entero de minutos no negativo.'), { statusCode: 400 });
  }
  return numero;
};

const validarGeocerca = (campos, crear = false) => {
  for (const [campo, minimo, maximo] of [['latitud', -90, 90], ['longitud', -180, 180], ['radio_geofence_m', 1, 2147483647]]) {
    const valor = campos[campo] ?? (crear && campo === 'radio_geofence_m' ? 100 : undefined);
    if (valor === undefined && !crear) continue;
    const numero = Number(valor);
    if (!['string', 'number'].includes(typeof valor) || String(valor).trim() === '' || !Number.isFinite(numero) || numero < minimo || numero > maximo ||
        (campo === 'radio_geofence_m' && !Number.isInteger(numero))) {
      throw Object.assign(new Error(`Valor inválido para ${campo}.`), { statusCode: 400 });
    }
  }
};

const listar = async (query, user) => {
  const where = {};
  if (query.estado) where.estado = query.estado;
  if (query.tipo_recinto) where.tipo_recinto = query.tipo_recinto;

  // Row-level security: supervisor ve sus instalaciones asignadas (o todas las activas si aún no tiene asignación)
  if (user && user.rol === ROLES.SUPERVISOR) {
    const ids = await resolverInstalacionesSupervisor(user);
    where.id = { in: ids };
  }

  return prisma.instalacion.findMany({
    where,
    include: {
      supervisores: {
        select: { supervisor_id: true },
      },
    },
    orderBy: { nombre: 'asc' },
  });
};

// Ficha de una instalación para el mapa: quién está de turno hoy, novedades abiertas y supervisores.
// Solo lectura. `prisma` ya está limitado a la empresa del token; el supervisor además
// queda limitado a sus instalaciones (exigirAlcanceInstalacion).
const URGENCIAS_RESUMEN = ['rojo', 'amarillo', 'verde'];
const resumen = async (id, user, ahora = new Date()) => {
  await exigirAlcanceInstalacion(user, id);
  const instalacion = await prisma.instalacion.findUniqueOrThrow({
    where: { id },
    select: {
      id: true, nombre: true, direccion: true, comuna: true, tipo_recinto: true, estado: true,
      nivel_criticidad: true, radio_geofence_m: true, tolerancia_atraso_minutos: true,
      supervisores: { select: { supervisor: { select: { nombre: true } } } },
    },
  });
  const ventana = turnosDeHoy(ahora);
  const [turnos, abiertas] = await Promise.all([
    prisma.turno.findMany({
      where: { instalacion_id: id, estado: { not: ESTADO_TURNO.CANCELADO }, ...ventana.where },
      select: {
        id: true, fecha: true, hora_inicio: true, hora_fin: true, usuario: { select: { nombre: true } },
        asistencias: { select: { estado: true, hora_entrada: true, hora_salida: true }, orderBy: { hora_entrada: 'desc' }, take: 1 },
      },
      orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }],
    }),
    prisma.novedad.findMany({
      where: { instalacion_id: id, ...SOLO_INCIDENCIAS, estado: { not: ESTADO_NOVEDAD.RESUELTA } },
      select: { numero: true, tipo: true, urgencia: true, estado: true, created_at: true },
      orderBy: { created_at: 'desc' },
    }),
  ]);

  const turnos_hoy = turnos.filter(ventana.incluir).map((t) => {
    const a = t.asistencias[0] ?? null;
    let estado = ahora < intervaloTurno(t).inicio ? 'por_iniciar' : 'faltante';
    if (a) estado = a.hora_salida ? 'finalizado' : (a.estado === 'tardio' ? 'tardio' : 'presente');
    return { turno_id: t.id, guardia: t.usuario?.nombre ?? 'Sin asignar', hora_inicio: t.hora_inicio, hora_fin: t.hora_fin,
      estado, hora_entrada: a?.hora_entrada ?? null };
  });

  const por_urgencia = Object.fromEntries(URGENCIAS_RESUMEN.map((u) => [u, abiertas.filter((n) => n.urgencia === u).length]));
  const { supervisores, ...datos } = instalacion;
  return {
    instalacion: datos,
    supervisores: supervisores.map((s) => s.supervisor.nombre),
    turnos_hoy,
    novedades_abiertas: { total: abiertas.length, ...por_urgencia, ultimas: abiertas.slice(0, 3) },
  };
};

// Novedades abiertas (no resueltas, sin rutina) por instalación y urgencia, para el anillo de color del mapa.
// Devuelve { [instalacion_id]: { total, rojo, amarillo, verde } } solo para instalaciones con pendientes.
const estadoNovedades = async (user) => {
  const where = { ...SOLO_INCIDENCIAS, estado: { not: ESTADO_NOVEDAD.RESUELTA } };
  if (user && user.rol === ROLES.SUPERVISOR) {
    where.instalacion_id = { in: await resolverInstalacionesSupervisor(user) };
  }
  const grupos = await prisma.novedad.groupBy({ by: ['instalacion_id', 'urgencia'], where, _count: { _all: true } });
  const porInstalacion = {};
  for (const g of grupos) {
    const fila = porInstalacion[g.instalacion_id] ??= { total: 0, rojo: 0, amarillo: 0, verde: 0 };
    if (g.urgencia in fila) fila[g.urgencia] += g._count._all;
    fila.total += g._count._all;
  }
  return porInstalacion;
};

const crear = async (data) => {
  const { supervisorIds, ...campos } = data;
  validarGeocerca(campos, true);
  const tolerancia = validarTolerancia(campos.tolerancia_atraso_minutos ?? TOLERANCIA_POR_DEFECTO_MINUTOS);

  return prisma.$transaction(async (tx) => {
    const nueva = await tx.instalacion.create({
      data: {
        ...campos,
        latitud:          parseFloat(campos.latitud),
        longitud:         parseFloat(campos.longitud),
        radio_geofence_m: parseInt(campos.radio_geofence_m ?? 100, 10),
        tolerancia_atraso_minutos: tolerancia,
      },
      include: {
        supervisores: {
          select: { supervisor_id: true },
        },
      },
    });

    // Sin esto, la instalación queda invisible para todo supervisor: el
    // listado de supervisores filtra por Supervisor_Instalacion (o el
    // fallback instalacion_asignada_id del usuario), y una instalación
    // recién creada no tiene ninguna fila ahí.
    if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
      await tx.supervisor_Instalacion.createMany({
        data: supervisorIds.map((supervisor_id) => ({ supervisor_id, instalacion_id: nueva.id })),
        skipDuplicates: true,
      });
    }

    return nueva;
  });
};

const obtenerPorId = async (id) => {
  return prisma.instalacion.findUniqueOrThrow({
    where: { id },
    include: {
      supervisores: {
        select: { supervisor_id: true },
      },
    },
  });
};

const ESTADOS_INSTALACION = ['activo', 'inactivo'];

const editar = async (id, data) => {
  const { supervisorIds, ...campos } = data;
  validarGeocerca(campos);

  if (campos.estado !== undefined) {
    if (!ESTADOS_INSTALACION.includes(campos.estado)) {
      throw Object.assign(new Error('El estado debe ser activo o inactivo.'), { statusCode: 400 });
    }
  }

  const dataToUpdate = { ...campos };
  if (campos.tolerancia_atraso_minutos !== undefined) {
    dataToUpdate.tolerancia_atraso_minutos = validarTolerancia(campos.tolerancia_atraso_minutos);
  }
  if (campos.latitud !== undefined) {
    dataToUpdate.latitud = parseFloat(campos.latitud);
  }
  if (campos.longitud !== undefined) {
    dataToUpdate.longitud = parseFloat(campos.longitud);
  }
  if (campos.radio_geofence_m !== undefined) {
    dataToUpdate.radio_geofence_m = parseInt(campos.radio_geofence_m, 10);
  }

  return prisma.$transaction(async (tx) => {
    // Al desactivar, los guardias quedan sin instalación asignada y sus turnos futuros
    // quedan por reasignar (los ve el supervisor a cargo). El historial no se toca.
    let guardiasSinInstalacion = 0;
    let turnosPorReasignar = 0;
    if (campos.estado === 'inactivo') {
      const hoy = new Date(new Date().toISOString().slice(0, 10));
      guardiasSinInstalacion = (await tx.usuario.updateMany({
        where: { instalacion_asignada_id: id },
        data: { instalacion_asignada_id: null },
      })).count;
      turnosPorReasignar = await tx.turno.count({
        where: { instalacion_id: id, estado: ESTADO_TURNO.PROGRAMADO, fecha: { gte: hoy } },
      });
    }
    const actualizada = await tx.instalacion.update({
      where: { id },
      data: dataToUpdate,
      include: {
        supervisores: {
          select: { supervisor_id: true },
        },
      },
    });

    // Si se envió el array, sincroniza las asignaciones (reemplaza el set completo,
    // igual que hace usuarios.service.js al editar un supervisor).
    if (Array.isArray(supervisorIds)) {
      await tx.supervisor_Instalacion.deleteMany({ where: { instalacion_id: id } });
      if (supervisorIds.length > 0) {
        await tx.supervisor_Instalacion.createMany({
          data: supervisorIds.map((supervisor_id) => ({ supervisor_id, instalacion_id: id })),
          skipDuplicates: true,
        });
      }
    }

    return { ...actualizada, guardias_sin_instalacion: guardiasSinInstalacion, turnos_por_reasignar: turnosPorReasignar };
  });
};

module.exports = { listar, obtenerPorId, resumen, estadoNovedades, crear, editar };
