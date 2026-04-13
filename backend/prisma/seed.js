require('dotenv').config();

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Coordenadas de tu casa
const MI_CASA_LAT = -33.631159950640374;
const MI_CASA_LON = -70.61026949159188;

async function main() {
  console.log('🌱 Iniciando seed...');

  // Limpiar datos previos en orden (respetar foreign keys)
  await prisma.asistencia.deleteMany();
  await prisma.novedad.deleteMany();
  await prisma.solicitud.deleteMany();
  await prisma.auditoria.deleteMany();
  await prisma.turno.deleteMany();
  await prisma.supervisor_Instalacion.deleteMany();
  await prisma.instalacion.deleteMany();
  await prisma.usuario.deleteMany();

  console.log('🧹 Base de datos limpia');

  // 1. Instalación
  const instalacion = await prisma.instalacion.create({
    data: {
      nombre: 'Casa de Prueba — Geoconstanza',
      direccion: 'Mi dirección de prueba',
      latitud: MI_CASA_LAT,
      longitud: MI_CASA_LON,
      radio_geofence_m: 100,
      tipo_recinto: 'Residencial',
      nivel_criticidad: 'Baja',
      estado: 'activo',
    },
  });
  console.log(`✅ Instalación: ${instalacion.nombre} (ID: ${instalacion.id})`);

  // 12 rounds — igual que BCRYPT_ROUNDS en auth.service.js
  const hashGeo    = await bcrypt.hash('geo2026', 12);
  const hashTest   = await bcrypt.hash('123456', 12);

  // 2. Guardia principal
  const guardia = await prisma.usuario.create({
    data: {
      rut: '20570418-3',
      nombre: 'Víctor Norambuena',
      email: 'victor.norambuena@geoconstanza.cl',
      telefono: '+56912345678',
      password_hash: hashGeo,
      rol: 'pauta',
      estado: 'activo',
    },
  });
  console.log(`✅ Guardia: ${guardia.nombre} | ${guardia.email}`);

  // 3. Usuario test (el que pediste)
  const guardiaTest = await prisma.usuario.create({
    data: {
      rut: '11111111-1',
      nombre: 'Usuario Test',
      email: 'test@test.com',
      password_hash: hashTest,
      rol: 'pauta',
      estado: 'activo',
    },
  });
  console.log(`✅ Test: ${guardiaTest.email} | pass: 123456`);

  // 4. Supervisor
  const supervisor = await prisma.usuario.create({
    data: {
      rut: '15678901-2',
      nombre: 'Andrés Martínez',
      email: 'andres.martinez@geoconstanza.cl',
      password_hash: hashGeo,
      rol: 'supervisor',
      estado: 'activo',
    },
  });
  console.log(`✅ Supervisor: ${supervisor.nombre}`);

  // 5. Asignar supervisor a instalación
  await prisma.supervisor_Instalacion.create({
    data: {
      supervisor_id: supervisor.id,
      instalacion_id: instalacion.id,
    },
  });

  // 6. Turno HOY para guardia principal
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const turno = await prisma.turno.create({
    data: {
      usuario_id: guardia.id,
      instalacion_id: instalacion.id,
      fecha: hoy,
      hora_inicio: '06:00',
      hora_fin: '14:00',
      tipo_turno: 'normal',
      estado: 'programado',
      creado_por: supervisor.id,
    },
  });
  console.log(`✅ Turno guardia: ${turno.hora_inicio}–${turno.hora_fin}`);

  // 7. Turno HOY para usuario test
  const turnoTest = await prisma.turno.create({
    data: {
      usuario_id: guardiaTest.id,
      instalacion_id: instalacion.id,
      fecha: hoy,
      hora_inicio: '06:00',
      hora_fin: '14:00',
      tipo_turno: 'normal',
      estado: 'programado',
      creado_por: supervisor.id,
    },
  });
  console.log(`✅ Turno test: ${turnoTest.hora_inicio}–${turnoTest.hora_fin}`);
  // backend/prisma/seed.js

// ... después del supervisor ...

  // 8. GGSS Libre (aparece en el DemoPanel pero faltaba en el seed)
  const guardiaLibre = await prisma.usuario.create({
    data: {
      rut: '19234567-8',
      nombre: 'M. López',
      email: 'm.lopez@geoconstanza.cl',
      password_hash: hashGeo,
      rol: 'libre',
      estado: 'activo',
    },
  });
  console.log(`✅ GGSS Libre: ${guardiaLibre.nombre} | ${guardiaLibre.email}`);

  // 9. Administrador
  const admin = await prisma.usuario.create({
    data: {
      rut: '12812223-0',
      nombre: 'C. González',
      email: 'admin@geoconstanza.cl',
      password_hash: hashGeo,
      rol: 'admin',
      estado: 'activo',
    },
  });
  console.log(`✅ Admin: ${admin.nombre} | ${admin.email}`);

  console.log('\n📋 RESUMEN:');
  console.log(`   Instalación ID : ${instalacion.id}`);
  console.log(`   Guardia Pauta  : ${guardia.email} | geo2026`);
  console.log(`   Guardia Libre  : ${guardiaLibre.email} | geo2026`);
  console.log(`   Test           : ${guardiaTest.email} | 123456`);
  console.log(`   Supervisor     : ${supervisor.email} | geo2026`);
  console.log(`   Admin          : ${admin.email} | geo2026`);
  console.log(`   Turno hoy      : 06:00–14:00 en ${instalacion.nombre}`);
  console.log('\n✅ Seed completado');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
