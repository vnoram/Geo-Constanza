// src/utils/tiempo.js
//
// Utilidades de tiempo en hora de Chile (America/Santiago).
//
// Los turnos guardan la hora como texto "HH:MM" en hora de Chile y la fecha como
// día de calendario (columna @db.Date). El servidor corre en UTC, así que toda
// comparación entre un turno y un instante real debe pasar por estas funciones.
// No usar Date.UTC ni setHours con la hora del turno: ambos ignoran la zona de Chile.

const ZONA = 'America/Santiago';
const MIN_MS = 60 * 1000;
const HORA_MS = 60 * MIN_MS;
const DIA_MS = 24 * HORA_MS;

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

/** Desfase de Chile respecto de UTC, en minutos, en un instante dado (ej. -180 en verano). */
const offsetZonaMin = (instante) => {
  const p = partesEnZona(instante);
  const comoUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const base = Math.floor(instante.getTime() / 1000) * 1000;
  return Math.round((comoUTC - base) / MIN_MS);
};

/** Instante UTC en que ocurre `fecha` (día de calendario) + "HH:MM" en hora de Chile. */
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

/** Medianoche UTC del día de calendario de `d`, para filtrar columnas @db.Date. */
const diaUTC = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

module.exports = {
  ZONA, MIN_MS, HORA_MS, DIA_MS,
  offsetZonaMin, instanteChile, inicioTurno, finTurno, diaChile, diaUTC,
};
