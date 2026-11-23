// Alertas del guardia: se arman con datos que ya existen (turnos, novedades, solicitudes, marcajes).
// No hay tabla de notificaciones: cada alerta es un hecho reciente que le concierne al propio guardia.
const { prisma } = require('../config/database');
const { ahoraChile, sumarDias, aFechaDB, intervaloTurno } = require('../utils/fechaChile');

const VENTANA_DIAS = 7;
const HORAS_AVISO_TURNO = 36;
const MAX_ALERTAS = 20;

const FRASE_NOVEDAD = { en_atencion: 'está en atención', resuelta: 'fue resuelta', escalada: 'fue escalada' };
const NIVEL_NOVEDAD = { en_atencion: 'info', resuelta: 'ok', escalada: 'warning' };

/** Convierte los hechos en alertas ordenadas (primero el turno próximo, luego lo más reciente). */
function construirAlertas({ turnos = [], novedades = [], solicitudes = [], marcajes = [], ahora = new Date() }) {
  const alertas = [];

  const proximo = turnos
    .map((t) => ({ t, ...intervaloTurno(t) }))
    .filter((x) => x.fin > ahora && x.inicio.getTime() - ahora.getTime() <= HORAS_AVISO_TURNO * 3600000)
    .sort((a, b) => a.inicio - b.inicio)[0];
  if (proximo) {
    const enCurso = proximo.inicio <= ahora;
    alertas.push({
      id: `turno-${proximo.t.id}`, tipo: 'turno', nivel: enCurso ? 'info' : 'warning',
      titulo: `${enCurso ? 'Turno en curso' : 'Próximo turno'}: ${proximo.t.hora_inicio} — ${proximo.t.hora_fin}`,
      detalle: proximo.t.instalacion?.nombre || 'Instalación asignada', fecha: proximo.inicio.toISOString(),
    });
  }

  for (const n of novedades) {
    if (!FRASE_NOVEDAD[n.estado]) continue;
    const quien = n.responsable?.nombre ? ` · ${n.responsable.nombre}` : '';
    alertas.push({
      id: `novedad-${n.id}`, tipo: 'novedad', nivel: NIVEL_NOVEDAD[n.estado],
      titulo: `Tu novedad N°${n.numero} (${n.tipo}) ${FRASE_NOVEDAD[n.estado]}`,
      detalle: `${n.comentario_cierre || 'Atendida por el supervisor'}${quien}`, fecha: (n.fecha_atencion || n.created_at).toISOString(),
    });
  }

  for (const s of solicitudes) {
    if (s.estado !== 'aprobada' && s.estado !== 'rechazada') continue;
    const ok = s.estado === 'aprobada';
    alertas.push({
      id: `solicitud-${s.id}`, tipo: 'solicitud', nivel: ok ? 'ok' : 'error',
      titulo: `Tu solicitud de ${String(s.tipo).replace('_', ' ')} fue ${ok ? 'aprobada' : 'rechazada'}`,
      detalle: `${s.comentario_revision || 'Sin comentario'}${s.revisor?.nombre ? ` · ${s.revisor.nombre}` : ''}`, fecha: s.updated_at.toISOString(),
    });
  }

  for (const m of marcajes) {
    if (m.revision_estado !== 'aprobado' && m.revision_estado !== 'rechazado') continue;
    const ok = m.revision_estado === 'aprobado';
    alertas.push({
      id: `marcaje-${m.id}`, tipo: 'marcaje', nivel: ok ? 'ok' : 'error',
      titulo: `Tu marcaje fuera de la instalación fue ${ok ? 'autorizado' : 'rechazado'}`,
      detalle: m.comentario_revision || 'Sin comentario', fecha: (m.revisado_en || m.hora_entrada).toISOString(),
    });
  }

  alertas.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const lista = [...alertas.filter((a) => a.tipo === 'turno'), ...alertas.filter((a) => a.tipo !== 'turno')];
  return lista.slice(0, MAX_ALERTAS);
}

/** Alertas del guardia autenticado (siempre acotadas a su empresa y a su propio usuario). */
async function listarMias(user, ahora = new Date()) {
  const hoy = ahoraChile(ahora).fecha;
  const desde = new Date(ahora.getTime() - VENTANA_DIAS * 86400000);
  const base = { empresa_id: user.empresaId, usuario_id: user.id };
  const [turnos, novedades, solicitudes, marcajes] = await Promise.all([
    prisma.turno.findMany({
      where: { ...base, estado: { not: 'cancelado' }, fecha: { gte: aFechaDB(sumarDias(hoy, -1)), lte: aFechaDB(sumarDias(hoy, 2)) } },
      include: { instalacion: { select: { nombre: true } } },
    }),
    prisma.novedad.findMany({
      where: { ...base, estado: { not: 'abierta' }, OR: [{ fecha_atencion: { gte: desde } }, { created_at: { gte: desde } }] },
      include: { responsable: { select: { nombre: true } } }, orderBy: { created_at: 'desc' }, take: 20,
    }),
    prisma.solicitud.findMany({
      where: { ...base, estado: { in: ['aprobada', 'rechazada'] }, updated_at: { gte: desde } },
      include: { revisor: { select: { nombre: true } } }, orderBy: { updated_at: 'desc' }, take: 20,
    }),
    prisma.asistencia.findMany({
      where: { ...base, revision_estado: { in: ['aprobado', 'rechazado'] }, hora_entrada: { gte: desde } },
      orderBy: { hora_entrada: 'desc' }, take: 20,
    }),
  ]);
  return construirAlertas({ turnos, novedades, solicitudes, marcajes, ahora });
}

module.exports = { construirAlertas, listarMias };
