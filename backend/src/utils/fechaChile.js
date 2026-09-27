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

/**
 * Turnos que cuentan como "de hoy": los que comienzan hoy más los nocturnos
 * de ayer que todavía no terminan.
 *
 * @returns {{ where: object, incluir: (turno) => boolean, hoy: string }}
 *   `where` para la consulta Prisma y `incluir` para filtrar el resultado.
 */
const turnosDeHoy = (d = new Date()) => {
  const { fecha: hoy, hora } = ahoraChile(d);
  const ayer = sumarDias(hoy, -1);
  return {
    hoy,
    where: { fecha: { in: [aFechaDB(ayer), aFechaDB(hoy)] } },
    incluir: (turno) => {
      const fecha = new Date(turno.fecha).toISOString().slice(0, 10);
      if (fecha === hoy) return true;
      return fecha === ayer && esNocturno(turno) && hora < turno.hora_fin;
    },
  };
};

module.exports = { ahoraChile, sumarDias, aFechaDB, esNocturno, turnosDeHoy };
