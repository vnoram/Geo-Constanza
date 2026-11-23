/**
 * Siembra de demostración (NO destructiva): agrega a una empresa existente instalaciones, supervisores,
 * guardias y sus turnos 4x4 a 6 meses, para simular una operación sin cargarlos a mano.
 *
 * - No borra nada que no sea suyo: solo toca usuarios con correo @alfa.demo (los que crea este script).
 * - Se puede repetir: los usuarios e instalaciones se reutilizan y los turnos programados de esos
 *   usuarios se regeneran desde cero.
 * - Se niega a correr contra una base que no sea local (localhost, 127.0.0.1, db) salvo --forzar.
 *
 * Uso (con la API en Docker):  docker compose exec api node prisma/sembrar-demo-empresa.js
 * Opciones:  --empresa "Seguridad Alfa Ltda."   --forzar
 * Contraseña de todos los usuarios creados: geo2026
 */
const CICLO = 8;
const DIAS_PAUTA = 184; // 23 ciclos = 6 meses, igual que la pauta 4x4 de la aplicación
const DIAS_ATRAS = 7; // un poco de historial para ver turnos ya pasados

const INSTALACIONES = [
  { nombre: 'Condominio Los Robles', direccion: 'Av. Concha y Toro 1520, Puente Alto', comuna: 'Puente Alto', latitud: -33.6105, longitud: -70.5758, radio: 120, criticidad: 'Media', recinto: 'Residencial' },
  { nombre: 'Centro Comercial Plaza Sur', direccion: 'Av. Vicuña Mackenna 8100, La Florida', comuna: 'La Florida', latitud: -33.5226, longitud: -70.5989, radio: 150, criticidad: 'Alta', recinto: 'Comercial' },
  { nombre: 'Bodega Logística Norte', direccion: 'Av. Américo Vespucio 1100, Quilicura', comuna: 'Quilicura', latitud: -33.3637, longitud: -70.7371, radio: 200, criticidad: 'Alta', recinto: 'Industrial' },
];

const NOMBRES = [
  'Camila Soto', 'Matías Rojas', 'Javiera Muñoz', 'Felipe Contreras', 'Constanza Araya', 'Sebastián Fuentes',
  'Valentina Pizarro', 'Nicolás Espinoza', 'Francisca Tapia', 'Diego Sandoval', 'Ignacia Carrasco', 'Tomás Vargas',
];
const SUPERVISORES = ['Patricio Herrera', 'Marcela Bravo', 'Cristián Lagos'];

// Cuatro turnos por instalación para cubrir 24/7: día y noche, con dos cuadrillas desfasadas 4 días.
const PLANTILLA = [
  { hora_inicio: '07:00', hora_fin: '19:00', desfase: 0 },
  { hora_inicio: '07:00', hora_fin: '19:00', desfase: 4 },
  { hora_inicio: '19:00', hora_fin: '07:00', desfase: 0 },
  { hora_inicio: '19:00', hora_fin: '07:00', desfase: 4 },
];

const aISO = (d) => d.toISOString().slice(0, 10);
const sumarDias = (iso, n) => {
  const [a, m, d] = iso.split('-').map(Number);
  return aISO(new Date(Date.UTC(a, m - 1, d + n)));
};

/** Fechas (ISO) en que trabaja un guardia 4x4: 4 días de trabajo y 4 de descanso, con desfase. */
function fechasDeTrabajo(inicioISO, desfase, dias = DIAS_PAUTA) {
  const fechas = [];
  for (let i = 0; i < dias; i += 1) {
    if (((i + desfase) % CICLO) < 4) fechas.push(sumarDias(inicioISO, i));
  }
  return fechas;
}

const esBaseLocal = (url) => {
  try { return ['localhost', '127.0.0.1', 'db'].includes(new URL(url).hostname); } catch { return false; }
};

async function main() {
  require('dotenv').config();
  const args = process.argv.slice(2);
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const nombreEmpresa = val('--empresa') || 'Seguridad Alfa Ltda.';
  if (!esBaseLocal(process.env.DATABASE_URL) && !args.includes('--forzar')) {
    throw new Error('DATABASE_URL no es una base local. Si de verdad quieres sembrar ahí, agrega --forzar.');
  }

  const { Pool } = require('pg');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const { ROLES } = require('../src/constants/roles');
  const { calcularDv } = require('../src/utils/rut');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const rutDe = (n) => `${n}-${calcularDv(String(n))}`;

  try {
    const empresa = await prisma.empresa.findFirst({ where: { nombre: nombreEmpresa } });
    if (!empresa) throw new Error(`No existe la empresa "${nombreEmpresa}". Usa --empresa con el nombre exacto.`);
    const hash = await bcrypt.hash('geo2026', 12);
    const hoyISO = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    const inicioISO = sumarDias(hoyISO, -DIAS_ATRAS);
    let n = 0;
    const resumen = { instalaciones: 0, supervisores: 0, guardias: 0, turnos: 0 };

    for (const [i, def] of INSTALACIONES.entries()) {
      let inst = await prisma.instalacion.findFirst({ where: { empresa_id: empresa.id, nombre: def.nombre } });
      if (!inst) {
        inst = await prisma.instalacion.create({ data: {
          empresa_id: empresa.id, nombre: def.nombre, direccion: def.direccion, comuna: def.comuna, latitud: def.latitud,
          longitud: def.longitud, radio_geofence_m: def.radio, tipo_recinto: def.recinto, nivel_criticidad: def.criticidad, estado: 'activo',
        } });
        resumen.instalaciones += 1;
      }

      const emailSup = `supervisor${i + 1}@alfa.demo`;
      let sup = await prisma.usuario.findUnique({ where: { email: emailSup } });
      if (!sup) {
        sup = await prisma.usuario.create({ data: {
          empresa_id: empresa.id, rut: rutDe(22100000 + i), nombre: SUPERVISORES[i], email: emailSup, password_hash: hash,
          rol: ROLES.SUPERVISOR, instalacion_asignada_id: inst.id, estado: 'activo',
        } });
        resumen.supervisores += 1;
      }
      const vinculo = await prisma.supervisor_Instalacion.findFirst({ where: { supervisor_id: sup.id, instalacion_id: inst.id } });
      if (!vinculo) await prisma.supervisor_Instalacion.create({ data: { empresa_id: empresa.id, supervisor_id: sup.id, instalacion_id: inst.id } });

      for (const plan of PLANTILLA) {
        n += 1;
        const email = `guardia${String(n).padStart(2, '0')}@alfa.demo`;
        let g = await prisma.usuario.findUnique({ where: { email } });
        if (!g) {
          g = await prisma.usuario.create({ data: {
            empresa_id: empresa.id, rut: rutDe(22200000 + n), nombre: NOMBRES[n - 1], email, password_hash: hash,
            rol: ROLES.GGSS, instalacion_asignada_id: inst.id, dispositivo_principal: 'mobil_empresa', estado: 'activo',
          } });
          resumen.guardias += 1;
        }
        // Solo se regeneran los turnos programados de este usuario demo que aún no tienen asistencias.
        await prisma.turno.deleteMany({ where: { usuario_id: g.id, estado: 'programado', fecha: { gte: new Date(`${inicioISO}T00:00:00Z`) }, asistencias: { none: {} } } });
        const data = fechasDeTrabajo(inicioISO, plan.desfase).map((f) => ({
          empresa_id: empresa.id, usuario_id: g.id, instalacion_id: inst.id, fecha: new Date(`${f}T00:00:00Z`),
          hora_inicio: plan.hora_inicio, hora_fin: plan.hora_fin,
          tipo_turno: plan.hora_fin < plan.hora_inicio ? 'nocturno' : 'normal', estado: 'programado',
        }));
        await prisma.turno.createMany({ data });
        resumen.turnos += data.length;
      }
    }
    console.log(`Sembrado en "${empresa.nombre}":`, resumen);
    console.log('Usuarios demo: supervisor1..3@alfa.demo y guardia01..12@alfa.demo — contraseña: geo2026 (el login es por RUT).');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

module.exports = { fechasDeTrabajo, esBaseLocal, DIAS_PAUTA, DIAS_ATRAS, CICLO, PLANTILLA };

if (require.main === module) main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
