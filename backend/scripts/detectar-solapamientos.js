// Solo lectura: no deduce horas de salida ni altera datos históricos.
const { intervaloTurno, seSolapan } = require('../src/utils/fechaChile');

const analizar = (turnos, abiertas) => {
  const porGuardia = new Map();
  for (const turno of turnos) {
    if (turno.estado === 'cancelado') continue;
    if (!porGuardia.has(turno.usuario_id)) porGuardia.set(turno.usuario_id, []);
    porGuardia.get(turno.usuario_id).push({ turno, intervalo: intervaloTurno(turno) });
  }
  const detalle = (t) => ({
    id: t.id, fecha: new Date(t.fecha).toISOString().slice(0, 10),
    horario: `${t.hora_inicio}–${t.hora_fin}`,
    instalacion: t.instalacion?.nombre || t.instalacion_id,
  });
  const solapamientos = [];
  for (const [usuario_id, lista] of porGuardia) {
    lista.sort((a, b) => a.intervalo.inicio - b.intervalo.inicio);
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length && lista[j].intervalo.inicio < lista[i].intervalo.fin; j++) {
        if (seSolapan(lista[i].intervalo, lista[j].intervalo)) {
          solapamientos.push({ usuario_id, turnos: [detalle(lista[i].turno), detalle(lista[j].turno)] });
        }
      }
    }
  }
  const porEntrada = new Map();
  for (const a of abiertas) {
    if (a.hora_salida != null) continue;
    if (!porEntrada.has(a.usuario_id)) porEntrada.set(a.usuario_id, []);
    porEntrada.get(a.usuario_id).push({ id: a.id, turno_id: a.turno_id, hora_entrada: a.hora_entrada });
  }
  const asistencias_duplicadas = [...porEntrada]
    .filter(([, asistencias]) => asistencias.length > 1)
    .map(([usuario_id, asistencias]) => ({ usuario_id, asistencias }));
  return { modo: 'solo lectura', solapamientos, asistencias_duplicadas };
};

const main = async () => {
  if (process.argv.includes('--help')) {
    console.log('Uso: node scripts/detectar-solapamientos.js\nLee backend/.env y emite JSON. No admite --aplicar ni modifica registros.');
    return;
  }
  if (process.argv.length > 2) throw new Error('Solo lectura: no se admiten flags de escritura ni otros argumentos.');
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const resultado = await prisma.$transaction(async (db) => {
      // PostgreSQL también impide escrituras durante esta inspección.
      await db.$executeRaw`SET TRANSACTION READ ONLY`;
      const turnos = await db.turno.findMany({
        where: { estado: { not: 'cancelado' } },
        select: { id: true, usuario_id: true, fecha: true, hora_inicio: true, hora_fin: true,
          instalacion_id: true, instalacion: { select: { nombre: true } } },
      });
      const abiertas = await db.asistencia.findMany({
        where: { hora_salida: null },
        select: { id: true, usuario_id: true, turno_id: true, hora_entrada: true },
      });
      return analizar(turnos, abiertas);
    }, { isolationLevel: 'RepeatableRead', timeout: 60000 });
    console.log(JSON.stringify(resultado, null, 2));
  } finally {
    await prisma.$disconnect();
  }
};

if (require.main === module) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

module.exports = { analizar };
