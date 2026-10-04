// src/utils/fechaChile.js
//
// Fechas y horas en hora de Chile, independiente de la zona horaria del
// servidor (Railway corre en UTC). Los turnos se registran en la fecha en que
// COMIENZAN; un turno nocturno (ej. 19:00–07:00) termina al día siguiente.

const ZONA = 'America/Santiago';

const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** @returns {{ fecha: string, hora: string }} fecha 'YYYY-MM-DD' y hora 'HH:MM' en Chile */
const ahoraChile = (d = new Date()) => {
  const p = Object.fromEntries(formato.formatToParts(d).map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
};

const sumarDias = (fechaISO, dias) => {
  const [a, m, d] = fechaISO.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
};

/** Convierte 'YYYY-MM-DD' al valor que Prisma espera para columnas @db.Date */
const aFechaDB = (fechaISO) => new Date(`${fechaISO}T00:00:00.000Z`);

const esNocturno = (turno) => turno.hora_fin < turno.hora_inicio;

/** Hora de pared chilena → UTC. En otoño se elige la primera ocurrencia;
 * en primavera una hora inexistente se desplaza hacia adelante por el salto.
 * Los offsets se obtienen de Intl, nunca de la zona del servidor.
 */
const instanteChile = (fechaISO, hora) => {
  const pared = Date.parse(`${fechaISO}T${hora}:00.000Z`);
  if (!Number.isFinite(pared) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    throw Object.assign(new Error('Fecha u hora de turno inválida'), { statusCode: 400 });
  }
  const offsets = new Set([-36, 0, 36].map((horas) => {
    const muestra = new Date(pared + horas * 3600000);
    const local = ahoraChile(muestra);
    return Date.parse(`${local.fecha}T${local.hora}:00Z`) - muestra.getTime();
  }));
  const candidatos = [...offsets].map((offset) => new Date(pared - offset));
  const exactos = candidatos.filter((d) => {
    const local = ahoraChile(d);
    return local.fecha === fechaISO && local.hora === hora;
  });
  return new Date(exactos.length
    ? Math.min(...exactos.map(Number))
    : Math.max(...candidatos.map(Number)));
};

/** Límites de un día civil chileno para filtrar columnas timestamp. */
const inicioDiaChile = (fechaISO) => instanteChile(fechaISO, '00:00');
const finDiaChile = (fechaISO) => new Date(inicioDiaChile(sumarDias(fechaISO, 1)).getTime() - 1);

const intervaloTurno = (turno) => {
  const fecha = new Date(turno.fecha).toISOString().slice(0, 10);
  return {
    inicio: instanteChile(fecha, turno.hora_inicio),
    fin: instanteChile(esNocturno(turno) ? sumarDias(fecha, 1) : fecha, turno.hora_fin),
  };
};

// Intervalos semiabiertos: se permiten relevos contiguos (06–14 / 14–22).
const seSolapan = (a, b) => a.inicio < b.fin && b.inicio < a.fin;

const turnoVigente = (turno, ahora, tolerancia = 0) => {
  const { inicio, fin } = intervaloTurno(turno);
  return ahora.getTime() >= inicio.getTime() - tolerancia * 60000 && ahora < fin;
};

/**
 * Turnos que cuentan como "de hoy": los que comienzan hoy más los nocturnos
 * de ayer que todavía no terminan.
 *
 * @returns {{ where: object, incluir: (turno) => boolean, hoy: string }}
 *   `where` para la consulta Prisma y `incluir` para filtrar el resultado.
 */
const turnosDeHoy = (d = new Date()) => {
  const { fecha: hoy } = ahoraChile(d);
  const ayer = sumarDias(hoy, -1);
  return {
    hoy,
    where: { fecha: { in: [aFechaDB(ayer), aFechaDB(hoy)] } },
    incluir: (turno) => {
      const fecha = new Date(turno.fecha).toISOString().slice(0, 10);
      if (fecha === hoy) return true;
      return fecha === ayer && esNocturno(turno) && d < intervaloTurno(turno).fin;
    },
  };
};

module.exports = { ahoraChile, sumarDias, aFechaDB, esNocturno, turnosDeHoy,
  instanteChile, inicioDiaChile, finDiaChile, intervaloTurno, seSolapan, turnoVigente };
