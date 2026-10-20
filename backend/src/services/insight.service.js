// src/services/insight.service.js
//
// "Insight" = panel de línea base y alertas por reglas (sin IA).
// Corresponde a las etapas 1 y 2 del informe EVA3: medir antes de predecir y
// activar reglas simples y explicables. No escribe en la base de datos.
//
// Estructura:
//   - Funciones puras (construirInsight y auxiliares): reciben datos ya leídos y
//     devuelven el resultado. Se prueban sin base de datos.
//   - getInsight: lee la base de datos con el alcance del rol y llama a lo anterior.

const { prisma } = require('../config/database');
const { resolverInstalacionesSupervisor } = require('./supervisor.helper');
const { ROLES } = require('../constants/roles');

const ZONA = 'America/Santiago';
const MIN_MS = 60 * 1000;
const HORA_MS = 60 * MIN_MS;
const DIA_MS = 24 * HORA_MS;

// Umbrales de las reglas. Están juntos y a la vista para poder explicarlos y
// ajustarlos con la empresa piloto (se devuelven también en la respuesta).
const UMBRALES = {
  SIN_MARCAJE_MIN: 15,              // minutos tras el inicio sin marcaje → turno descubierto
  SIN_MARCAJE_ALTA_MIN: 30,         // desde aquí la alerta sube a prioridad alta
  TARDIO_MIN: 10,                   // mismo criterio que asistencia.service (ATRASO_MINUTOS)
  RECURRENTE_EVENTOS: 3,            // atrasos o ausencias del guardia en la ventana
  RECURRENTE_VENTANA_DIAS: 14,
  RECURRENTE_HORIZONTE_H: 24,       // solo turnos que empiezan en las próximas horas
  NOVEDAD_ROJA_SIN_ATENCION_MIN: 30,
  PATRON_NOVEDADES: 3,              // novedades amarillas o rojas en la misma instalación
  PATRON_VENTANA_DIAS: 7,
  RECIENTE_H: 24,                   // ventana para marcajes de respaldo y novedades fuera de rango
  MAX_ALERTAS: 50,
};

const REGLAS = [
  { id: 'SIN_MARCAJE', descripcion: `Turno en curso sin marcaje a los ${UMBRALES.SIN_MARCAJE_MIN} min del inicio.` },
  { id: 'RIESGO_RECURRENTE', descripcion: `Guardia con ${UMBRALES.RECURRENTE_EVENTOS} o más atrasos o ausencias en ${UMBRALES.RECURRENTE_VENTANA_DIAS} días y un turno en las próximas ${UMBRALES.RECURRENTE_HORIZONTE_H} h.` },
  { id: 'NOVEDAD_ROJA_PENDIENTE', descripcion: `Novedad roja sin atender hace más de ${UMBRALES.NOVEDAD_ROJA_SIN_ATENCION_MIN} min.` },
  { id: 'PATRON_NOVEDADES', descripcion: `${UMBRALES.PATRON_NOVEDADES} o más novedades amarillas o rojas en una instalación en ${UMBRALES.PATRON_VENTANA_DIAS} días.` },
  { id: 'MARCAJE_RESPALDO', descripcion: `Marcaje hecho desde móvil de respaldo en las últimas ${UMBRALES.RECIENTE_H} h.` },
  { id: 'NOVEDAD_FUERA_DE_RANGO', descripcion: `Novedad reportada fuera de la geocerca en las últimas ${UMBRALES.RECIENTE_H} h.` },
];

const PRIORIDAD_ORDEN = { alta: 0, media: 1, baja: 2 };
const CRITICIDAD_ORDEN = { Alta: 0, Media: 1, Baja: 2 };

// ─── Utilidades de tiempo (zona America/Santiago) ───────────────────────────
// Los turnos guardan la hora como texto "HH:MM" (hora de Chile) y la fecha como
// día de calendario. El servidor corre en UTC, así que se convierte con la zona.

const partesEnZona = (instante) => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instante);
  const v = {};
  partes.forEach((p) => { v[p.type] = Number(p.value); });
  return v;
};

const offsetZonaMin = (instante) => {
  const p = partesEnZona(instante);
  const comoUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const base = Math.floor(instante.getTime() / 1000) * 1000;
  return Math.round((comoUTC - base) / MIN_MS);
};

/** Instante UTC en que ocurre `fecha` + "HH:MM" en hora de Chile. */
const instanteChile = (fecha, hhmm) => {
  const f = new Date(fecha);
  const [h, m] = hhmm.split(':').map(Number);
  const ingenuo = Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate(), h, m);
  let t = ingenuo - offsetZonaMin(new Date(ingenuo)) * MIN_MS;
  t = ingenuo - offsetZonaMin(new Date(t)) * MIN_MS; // segunda pasada: bordes de cambio de hora
  return new Date(t);
};

const inicioTurno = (turno) => instanteChile(turno.fecha, turno.hora_inicio);

const finTurno = (turno) => {
  const inicio = inicioTurno(turno);
  const mismoDia = instanteChile(turno.fecha, turno.hora_fin);
  if (mismoDia > inicio) return mismoDia;
  // Turno nocturno: termina al día siguiente.
  const diaSiguiente = new Date(new Date(turno.fecha).getTime() + DIA_MS);
  return instanteChile(diaSiguiente, turno.hora_fin);
};

/** Día de calendario ("YYYY-MM-DD") de un instante, en hora de Chile. */
const diaChile = (instante) => {
  const p = partesEnZona(instante);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

const redondear = (n, dec = 1) => {
  const k = 10 ** dec;
  return Math.round(n * k) / k;
};
const pct = (parte, total) => (total > 0 ? redondear((parte / total) * 100, 1) : null);
const promedio = (xs) => (xs.length > 0 ? redondear(xs.reduce((a, b) => a + b, 0) / xs.length, 1) : null);

const minutosEntre = (a, b) => Math.floor((a.getTime() - b.getTime()) / MIN_MS);

// ─── Evaluación de un turno ────────────────────────────────────────────────

const evaluarTurno = (turno, ahora) => {
  const inicio = inicioTurno(turno);
  const fin = finTurno(turno);
  const asistencias = [...(turno.asistencias || [])]
    .sort((a, b) => new Date(a.hora_entrada) - new Date(b.hora_entrada));
  const asistencia = asistencias[0] || null;

  const retraso = asistencia
    ? Math.max(0, minutosEntre(new Date(asistencia.hora_entrada), inicio))
    : null;

  return {
    turno,
    inicio,
    fin,
    asistencia,
    retraso,
    tardio: retraso !== null && retraso > UMBRALES.TARDIO_MIN,
    futuro: inicio > ahora,
    // Descubierto: ya pasó la tolerancia y nadie marcó.
    descubierto: !asistencia && ahora.getTime() >= inicio.getTime() + UMBRALES.SIN_MARCAJE_MIN * MIN_MS,
    enCurso: ahora >= inicio && ahora < fin,
  };
};

// ─── Núcleo puro ───────────────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {Array}  p.turnos     Turnos (no cancelados) con usuario, instalacion y asistencias.
 * @param {Array}  p.novedades  Novedades con instalacion.
 * @param {Date}   p.ahora
 * @param {number} p.dias       Largo del período de la línea base.
 */
const construirInsight = ({ turnos, novedades, ahora, dias }) => {
  const desde = new Date(ahora.getTime() - dias * DIA_MS);
  const evaluados = turnos.map((t) => evaluarTurno(t, ahora));

  // Turnos que cuentan para la línea base: dentro del período y ya evaluables.
  const base = evaluados.filter((e) =>
    e.inicio >= desde && !e.futuro && (e.asistencia || e.descubierto));

  const cubiertos = base.filter((e) => e.asistencia);
  const descubiertos = base.filter((e) => !e.asistencia);
  const tardios = cubiertos.filter((e) => e.tardio);
  const respaldo = cubiertos.filter((e) => e.asistencia.es_fallback);

  const novPeriodo = novedades.filter((n) => new Date(n.created_at) >= desde);
  const porUrgencia = (u) => novPeriodo.filter((n) => n.urgencia === u);
  const atendidas = novPeriodo.filter((n) => n.fecha_atencion);
  const conGps = novPeriodo.filter((n) => n.gps_dentro_rango !== null && n.gps_dentro_rango !== undefined);

  const lineaBase = {
    turnosEvaluados: base.length,
    turnosCubiertos: cubiertos.length,
    turnosDescubiertos: descubiertos.length,
    coberturaPct: pct(cubiertos.length, base.length),
    tardios: tardios.length,
    tardiosPct: pct(tardios.length, cubiertos.length),
    retrasoPromedioMin: promedio(cubiertos.map((e) => e.retraso)),
    marcajesRespaldoPct: pct(respaldo.length, cubiertos.length),
    novedades: {
      total: novPeriodo.length,
      rojas: porUrgencia('rojo').length,
      amarillas: porUrgencia('amarillo').length,
      verdes: porUrgencia('verde').length,
      abiertas: novPeriodo.filter((n) => n.estado === 'abierta').length,
      escaladas: novPeriodo.filter((n) => n.estado === 'escalada').length,
      tiempoMedioAtencionMin: promedio(
        atendidas.map((n) => Math.max(0, minutosEntre(new Date(n.fecha_atencion), new Date(n.created_at)))),
      ),
      fueraDeRangoPct: pct(conGps.filter((n) => n.gps_dentro_rango === false).length, conGps.length),
    },
  };

  // ── Tendencia diaria ──
  const dia0 = new Date(desde.getTime());
  const dias_ = [];
  for (let i = 0; i <= dias; i++) dias_.push(diaChile(new Date(dia0.getTime() + i * DIA_MS)));
  const serie = new Map(dias_.map((d) => [d, {
    fecha: d, evaluados: 0, cubiertos: 0, descubiertos: 0, tardios: 0, novedades: 0,
  }]));
  base.forEach((e) => {
    const fila = serie.get(diaChile(e.inicio));
    if (!fila) return;
    fila.evaluados += 1;
    if (e.asistencia) { fila.cubiertos += 1; if (e.tardio) fila.tardios += 1; } else { fila.descubiertos += 1; }
  });
  novPeriodo.forEach((n) => {
    const fila = serie.get(diaChile(new Date(n.created_at)));
    if (fila) fila.novedades += 1;
  });
  const tendencia = [...serie.values()];

  // ── Por instalación ──
  const mapaInst = new Map();
  const instDe = (inst) => {
    if (!mapaInst.has(inst.id)) {
      mapaInst.set(inst.id, {
        id: inst.id, nombre: inst.nombre, criticidad: inst.nivel_criticidad || 'Media',
        evaluados: 0, cubiertos: 0, descubiertos: 0, tardios: 0, novedadesRojas: 0, novedadesAmarillas: 0,
      });
    }
    return mapaInst.get(inst.id);
  };
  base.forEach((e) => {
    const f = instDe(e.turno.instalacion);
    f.evaluados += 1;
    if (e.asistencia) { f.cubiertos += 1; if (e.tardio) f.tardios += 1; } else { f.descubiertos += 1; }
  });
  novPeriodo.forEach((n) => {
    const f = instDe(n.instalacion);
    if (n.urgencia === 'rojo') f.novedadesRojas += 1;
    if (n.urgencia === 'amarillo') f.novedadesAmarillas += 1;
  });
  const porInstalacion = [...mapaInst.values()]
    .map((f) => ({
      ...f,
      coberturaPct: pct(f.cubiertos, f.evaluados),
      // Puntaje simple y explicable: descubierto 3, tardío 1, novedad roja 5, amarilla 1.
      puntos: f.descubiertos * 3 + f.tardios + f.novedadesRojas * 5 + f.novedadesAmarillas,
    }))
    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre));

  // ── Alertas por reglas ──
  const alertas = [];
  const agregar = (a) => alertas.push(a);

  // R1: turno en curso sin marcaje
  evaluados.filter((e) => e.enCurso && e.descubierto).forEach((e) => {
    const min = minutosEntre(ahora, e.inicio);
    const critica = e.turno.instalacion.nivel_criticidad === 'Alta';
    agregar({
      id: `SIN_MARCAJE:${e.turno.id}`,
      regla: 'SIN_MARCAJE',
      prioridad: critica || min >= UMBRALES.SIN_MARCAJE_ALTA_MIN ? 'alta' : 'media',
      titulo: `Sin marcaje: ${e.turno.usuario.nombre}`,
      detalle: `El turno de ${e.turno.hora_inicio} a ${e.turno.hora_fin} en ${e.turno.instalacion.nombre} lleva ${min} min sin marcaje.`,
      porQue: `Regla SIN_MARCAJE: más de ${UMBRALES.SIN_MARCAJE_MIN} min desde el inicio sin entrada registrada${critica ? '; instalación de criticidad Alta' : ''}.`,
      instalacion: { id: e.turno.instalacion.id, nombre: e.turno.instalacion.nombre, criticidad: e.turno.instalacion.nivel_criticidad || 'Media' },
      guardia: e.turno.usuario.nombre,
      turnoId: e.turno.id,
      desde: e.inicio.toISOString(),
    });
  });

  // R2: guardia con historial reciente de atrasos o ausencias y turno próximo
  const ventanaRec = new Date(ahora.getTime() - UMBRALES.RECURRENTE_VENTANA_DIAS * DIA_MS);
  const horizonte = new Date(ahora.getTime() + UMBRALES.RECURRENTE_HORIZONTE_H * HORA_MS);
  const historial = new Map(); // usuarioId -> { tardios, ausencias, retrasos[] }
  evaluados
    .filter((e) => e.inicio >= ventanaRec && !e.futuro && (e.asistencia || e.descubierto))
    .forEach((e) => {
      // Un turno aún en curso sin marcaje ya genera la alerta SIN_MARCAJE; no se cuenta dos veces.
      if (!e.asistencia && e.enCurso) return;
      const h = historial.get(e.turno.usuario.id) || { tardios: 0, ausencias: 0, retrasos: [] };
      if (e.asistencia && e.tardio) { h.tardios += 1; h.retrasos.push(e.retraso); }
      if (!e.asistencia) h.ausencias += 1;
      historial.set(e.turno.usuario.id, h);
    });
  evaluados.filter((e) => e.futuro && e.inicio <= horizonte && !e.asistencia).forEach((e) => {
    const h = historial.get(e.turno.usuario.id);
    if (!h) return;
    const eventos = h.tardios + h.ausencias;
    if (eventos < UMBRALES.RECURRENTE_EVENTOS) return;
    const prom = promedio(h.retrasos);
    agregar({
      id: `RIESGO_RECURRENTE:${e.turno.id}`,
      regla: 'RIESGO_RECURRENTE',
      prioridad: 'media',
      titulo: `Riesgo de atraso: ${e.turno.usuario.nombre}`,
      detalle: `Turno de ${e.turno.hora_inicio} en ${e.turno.instalacion.nombre} (${e.inicio.toISOString()}). Tuvo ${h.tardios} atraso(s) y ${h.ausencias} ausencia(s) en ${UMBRALES.RECURRENTE_VENTANA_DIAS} días.`,
      porQue: `Regla RIESGO_RECURRENTE: ${eventos} eventos (umbral ${UMBRALES.RECURRENTE_EVENTOS})${prom !== null ? `; atraso promedio ${prom} min` : ''}. Es una señal de apoyo para anticipar un reemplazo, no una sanción.`,
      instalacion: { id: e.turno.instalacion.id, nombre: e.turno.instalacion.nombre, criticidad: e.turno.instalacion.nivel_criticidad || 'Media' },
      guardia: e.turno.usuario.nombre,
      turnoId: e.turno.id,
      desde: e.inicio.toISOString(),
    });
  });

  // R3: novedades rojas sin atender
  novedades
    .filter((n) => n.urgencia === 'rojo' && n.estado !== 'resuelta' && !n.fecha_atencion)
    .forEach((n) => {
      const min = minutosEntre(ahora, new Date(n.created_at));
      if (min < UMBRALES.NOVEDAD_ROJA_SIN_ATENCION_MIN) return;
      agregar({
        id: `NOVEDAD_ROJA_PENDIENTE:${n.id}`,
        regla: 'NOVEDAD_ROJA_PENDIENTE',
        prioridad: 'alta',
        titulo: `Novedad roja sin atender: ${n.tipo}`,
        detalle: `${n.instalacion.nombre}: reportada hace ${min} min, estado ${n.estado}.`,
        porQue: `Regla NOVEDAD_ROJA_PENDIENTE: urgencia roja sin atención por más de ${UMBRALES.NOVEDAD_ROJA_SIN_ATENCION_MIN} min.`,
        instalacion: { id: n.instalacion.id, nombre: n.instalacion.nombre, criticidad: n.instalacion.nivel_criticidad || 'Media' },
        guardia: null,
        novedadId: n.id,
        desde: new Date(n.created_at).toISOString(),
      });
    });

  // R4: patrón de novedades en una instalación
  const ventanaPatron = new Date(ahora.getTime() - UMBRALES.PATRON_VENTANA_DIAS * DIA_MS);
  const patron = new Map();
  novedades
    .filter((n) => new Date(n.created_at) >= ventanaPatron && (n.urgencia === 'rojo' || n.urgencia === 'amarillo'))
    .forEach((n) => {
      const g = patron.get(n.instalacion.id) || { inst: n.instalacion, total: 0, rojas: 0, tipos: new Map() };
      g.total += 1;
      if (n.urgencia === 'rojo') g.rojas += 1;
      g.tipos.set(n.tipo, (g.tipos.get(n.tipo) || 0) + 1);
      patron.set(n.instalacion.id, g);
    });
  patron.forEach((g) => {
    if (g.total < UMBRALES.PATRON_NOVEDADES) return;
    const [tipoTop, cantTop] = [...g.tipos.entries()].sort((a, b) => b[1] - a[1])[0];
    agregar({
      id: `PATRON_NOVEDADES:${g.inst.id}`,
      regla: 'PATRON_NOVEDADES',
      prioridad: g.rojas > 0 ? 'alta' : 'media',
      titulo: `Patrón de novedades en ${g.inst.nombre}`,
      detalle: `${g.total} novedades amarillas o rojas en ${UMBRALES.PATRON_VENTANA_DIAS} días (${g.rojas} rojas). Tipo más repetido: ${tipoTop} (${cantTop}).`,
      porQue: `Regla PATRON_NOVEDADES: ${g.total} novedades en la misma instalación (umbral ${UMBRALES.PATRON_NOVEDADES}).`,
      instalacion: { id: g.inst.id, nombre: g.inst.nombre, criticidad: g.inst.nivel_criticidad || 'Media' },
      guardia: null,
    });
  });

  // R5 y R6: señales de calidad de dato en las últimas horas
  const reciente = new Date(ahora.getTime() - UMBRALES.RECIENTE_H * HORA_MS);
  evaluados
    .filter((e) => e.asistencia && e.asistencia.es_fallback && new Date(e.asistencia.hora_entrada) >= reciente)
    .forEach((e) => {
      agregar({
        id: `MARCAJE_RESPALDO:${e.turno.id}`,
        regla: 'MARCAJE_RESPALDO',
        prioridad: 'baja',
        titulo: `Marcaje por móvil de respaldo: ${e.turno.usuario.nombre}`,
        detalle: `${e.turno.instalacion.nombre}: la entrada no se hizo desde la tablet de la instalación.`,
        porQue: 'Regla MARCAJE_RESPALDO: conviene revisar si la tablet estaba disponible.',
        instalacion: { id: e.turno.instalacion.id, nombre: e.turno.instalacion.nombre, criticidad: e.turno.instalacion.nivel_criticidad || 'Media' },
        guardia: e.turno.usuario.nombre,
        turnoId: e.turno.id,
        desde: new Date(e.asistencia.hora_entrada).toISOString(),
      });
    });
  novedades
    .filter((n) => n.gps_dentro_rango === false && new Date(n.created_at) >= reciente)
    .forEach((n) => {
      agregar({
        id: `NOVEDAD_FUERA_DE_RANGO:${n.id}`,
        regla: 'NOVEDAD_FUERA_DE_RANGO',
        prioridad: 'baja',
        titulo: `Novedad fuera de la geocerca: ${n.tipo}`,
        detalle: `${n.instalacion.nombre}: el reporte se hizo fuera del radio de la instalación.`,
        porQue: 'Regla NOVEDAD_FUERA_DE_RANGO: revisar si el guardia reportó desde otro lugar.',
        instalacion: { id: n.instalacion.id, nombre: n.instalacion.nombre, criticidad: n.instalacion.nivel_criticidad || 'Media' },
        guardia: null,
        novedadId: n.id,
        desde: new Date(n.created_at).toISOString(),
      });
    });

  alertas.sort((a, b) =>
    PRIORIDAD_ORDEN[a.prioridad] - PRIORIDAD_ORDEN[b.prioridad]
    || (CRITICIDAD_ORDEN[a.instalacion.criticidad] ?? 1) - (CRITICIDAD_ORDEN[b.instalacion.criticidad] ?? 1)
    || String(a.desde || '').localeCompare(String(b.desde || '')));

  return {
    periodo: { dias, desde: desde.toISOString(), hasta: ahora.toISOString(), zona: ZONA },
    lineaBase,
    tendencia,
    porInstalacion,
    alertas: alertas.slice(0, UMBRALES.MAX_ALERTAS),
    totalAlertas: alertas.length,
    reglas: REGLAS,
    umbrales: UMBRALES,
  };
};

// ─── Lectura desde la base de datos ────────────────────────────────────────

const DIAS_MIN = 7;
const DIAS_MAX = 90;

const getInsight = async (user, { dias = 30 } = {}) => {
  const periodo = Math.min(DIAS_MAX, Math.max(DIAS_MIN, Math.trunc(Number(dias)) || 30));
  const ahora = new Date();

  // Se lee al menos la ventana de historial que usa la regla de riesgo recurrente.
  const lectura = Math.max(periodo, UMBRALES.RECURRENTE_VENTANA_DIAS);
  const desde = new Date(ahora.getTime() - lectura * DIA_MS);
  const hasta = new Date(ahora.getTime() + 2 * DIA_MS);

  let filtroInst = {};
  if (user.rol === ROLES.SUPERVISOR) {
    const ids = await resolverInstalacionesSupervisor(user);
    filtroInst = { instalacion_id: { in: ids } };
  }

  const diaUTC = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  const [turnos, novedades] = await Promise.all([
    prisma.turno.findMany({
      where: {
        ...filtroInst,
        estado: { not: 'cancelado' },
        fecha: { gte: diaUTC(new Date(desde.getTime() - DIA_MS)), lte: diaUTC(hasta) },
      },
      select: {
        id: true, fecha: true, hora_inicio: true, hora_fin: true,
        usuario: { select: { id: true, nombre: true } },
        instalacion: { select: { id: true, nombre: true, nivel_criticidad: true } },
        asistencias: { select: { hora_entrada: true, es_fallback: true, estado: true } },
      },
    }),
    prisma.novedad.findMany({
      where: {
        ...filtroInst,
        OR: [
          { created_at: { gte: desde } },
          { urgencia: 'rojo', estado: { not: 'resuelta' } },
        ],
      },
      select: {
        id: true, tipo: true, urgencia: true, estado: true, created_at: true,
        fecha_atencion: true, gps_dentro_rango: true,
        instalacion: { select: { id: true, nombre: true, nivel_criticidad: true } },
      },
    }),
  ]);

  return construirInsight({ turnos, novedades, ahora, dias: periodo });
};

module.exports = {
  getInsight,
  construirInsight,
  // Exportadas para pruebas
  instanteChile,
  inicioTurno,
  finTurno,
  diaChile,
  UMBRALES,
};
