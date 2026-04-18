require('dotenv').config();

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Coordenadas de tu casa para pruebas de GPS
const MI_CASA_LAT = -33.631159950640374;
const MI_CASA_LON = -70.61026949159188;

async function main() {
  console.log('🌱 Iniciando seed con arquitectura de roles definitiva...');

  // 1. Limpiar datos previos en orden correcto
  await prisma.asistencia.deleteMany();
  await prisma.novedad.deleteMany();
  await prisma.solicitud.deleteMany();
  await prisma.auditoria.deleteMany();
  await prisma.turno.deleteMany();
  
  // Limpieza de tablas de usuario e instalación
  await prisma.usuario.deleteMany();
  await prisma.instalacion.deleteMany();

  console.log('🧹 Base de datos limpia');

  // 2. Crear Instalación Principal (Puente Alto)
  const instalacion = await prisma.instalacion.create({
    data: {
      nombre: 'CENTRO OPERATIVO PUENTE ALTO',
      direccion: 'Bajos de Mena',
      latitud: MI_CASA_LAT,
      longitud: MI_CASA_LON,
      radio_geofence_m: 150, // Radio de 150 metros
      tipo_recinto: 'Residencial',
      nivel_criticidad: 'Media',
      estado: 'activo',
    },
  });
  console.log(`✅ Instalación creada: ${instalacion.nombre}`);

  const hashGeo = await bcrypt.hash('geo2026', 12);

  // 3. Crear los 5 Roles Funcionales

  // ADMIN (El encargado de RRHH: agrega usuarios, asigna pautas)
  const adminGestion = await prisma.usuario.create({
    data: {
      rut: '12812223-0',
      nombre: 'Administrador de Gestión',
      email: 'gestion@geoconstanza.cl',
      password_hash: hashGeo,
      rol: 'admin',
      estado: 'activo',
    },
  });

  // CENTRAL (Operador de monitoreo: usa el email admin@... como pediste)
  await prisma.usuario.create({
    data: {
      rut: '11111111-1',
      nombre: 'Operador Central',
      email: 'admin@geoconstanza.cl',
      password_hash: hashGeo,
      rol: 'central',
      estado: 'activo',
    },
  });

  // SUPERVISOR (Control de terreno)
  const supervisor = await prisma.usuario.create({
    data: {
      rut: '15678901-2',
      nombre: 'Andrés Martínez',
      email: 'supervisor@geoconstanza.cl',
      password_hash: hashGeo,
      rol: 'supervisor',
      instalacion_asignada_id: instalacion.id,
      estado: 'activo',
    },
  });

  // GGSS PAUTA (Víctor - Marcaje en Tablet)
  const guardiaPauta = await prisma.usuario.create({
    data: {
      rut: '20570418-3',
      nombre: 'Víctor Norambuena',
      email: 'pauta@geoconstanza.cl',
      password_hash: hashGeo,
      rol: 'pauta',
      tipo_ggss: 'pauta',
      instalacion_asignada_id: instalacion.id,
      imei_dispositivo: 'TABLET_PROV_01',
      dispositivo_principal: 'tablet_empresa',
      estado: 'activo',
    },
  });

  // GGSS LIBRE (M. López - Marcaje en Móvil Personal)
  await prisma.usuario.create({
    data: {
      rut: '19234567-8',
      nombre: 'M. López',
      email: 'libre@geoconstanza.cl',
      password_hash: hashGeo,
      rol: 'libre',
      tipo_ggss: 'libre',
      instalacion_asignada_id: instalacion.id,
      dispositivo_principal: 'mobil_personal',
      estado: 'activo',
    },
  });

  console.log('✅ Usuarios y Roles creados con éxito.');

  // 4. Crear un Turno para hoy para Víctor (Pauta)
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);

  await prisma.turno.create({
    data: {
      usuario_id: guardiaPauta.id,
      instalacion_id: instalacion.id,
      fecha: hoy,
      hora_inicio: '08:00',
      hora_fin: '20:00',
      tipo_turno: 'normal',
      estado: 'programado',
      creado_por: adminGestion.id,
    },
  });

  console.log('\n📋 CREDENCIALES FINALES PARA LA DEMO:');
  console.log('--------------------------------------------------');
  console.log('ADMIN (Gestión)   : gestion@geoconstanza.cl | geo2026');
  console.log('CENTRAL (Mapa)    : admin@geoconstanza.cl | geo2026');
  console.log('SUPERVISOR        : supervisor@geoconstanza.cl | geo2026');
  console.log('PAUTA (Víctor)    : pauta@geoconstanza.cl | geo2026');
  console.log('LIBRE             : libre@geoconstanza.cl | geo2026');
  console.log('--------------------------------------------------');
  console.log('\n✅ Seed completado.');
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