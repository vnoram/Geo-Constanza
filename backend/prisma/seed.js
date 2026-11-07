require('dotenv').config();

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../src/constants/roles');
const { calcularDv } = require('../src/utils/rut');

// El seed usa su propio cliente SIN alcance por empresa (trabaja sobre todas) y por eso pasa
// empresa_id de forma explícita en cada registro.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Coordenadas de tu casa para pruebas de GPS (Empresa A)
const MI_CASA_LAT = -33.631159950640374;
const MI_CASA_LON = -70.61026949159188;
// Santiago centro (Empresa B)
const CENTRO_LAT = -33.4489;
const CENTRO_LON = -70.6693;

const rutDe = (cuerpo) => `${cuerpo}-${calcularDv(String(cuerpo))}`;

async function crearEmpresa({ nombre, rut, plan }) {
  return prisma.empresa.create({ data: { nombre, rut, plan, estado: 'activa' } });
}

async function crearNovedad(empresa, { usuario, instalacion, turno, tipo, descripcion, urgencia }) {
  // Folio correlativo POR empresa (mismo contador atómico que usa la aplicación)
  const { ultimo_folio: numero } = await prisma.empresa.update({
    where: { id: empresa.id },
    data: { ultimo_folio: { increment: 1 } },
    select: { ultimo_folio: true },
  });
  return prisma.novedad.create({
    data: {
      empresa_id: empresa.id,
      numero,
      usuario_id: usuario.id,
      instalacion_id: instalacion.id,
      turno_id: turno.id,
      tipo,
      descripcion,
      urgencia,
    },
  });
}

async function main() {
  console.log('🌱 Iniciando seed multiempresa (super admin + 2 empresas demo)...');

  // 1. Limpiar datos previos en orden correcto (de hijos a padres)
  await prisma.asistencia.deleteMany();
  await prisma.novedadHistorial.deleteMany();
  await prisma.novedad.deleteMany();
  await prisma.solicitud.deleteMany();
  await prisma.auditoria.deleteMany();
  await prisma.turno.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.supervisor_Instalacion.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.instalacion.deleteMany();
  await prisma.empresa.deleteMany();
  console.log('🧹 Base de datos limpia');

  const hashGeo = await bcrypt.hash('geo2026', 12);

  // 2. Nivel de plataforma: super admin (sin empresa)
  await prisma.usuario.create({
    data: {
      rut: rutDe(10000001),
      nombre: 'Plataforma Geo Constanza',
      email: 'plataforma@geoconstanza.cl',
      password_hash: hashGeo,
      rol: ROLES.SUPER_ADMIN,
      estado: 'activo',
    },
  });

  // 3. EMPRESA A — conserva las cuentas históricas de la demostración
  const empresaA = await crearEmpresa({ nombre: 'Seguridad Alfa Ltda.', rut: rutDe(76111111), plan: 'premium' });

  const instalacionA = await prisma.instalacion.create({
    data: {
      empresa_id: empresaA.id,
      nombre: 'CENTRO OPERATIVO PUENTE ALTO',
      direccion: 'Bajos de Mena',
      latitud: MI_CASA_LAT,
      longitud: MI_CASA_LON,
      radio_geofence_m: 150,
      tipo_recinto: 'Residencial',
      nivel_criticidad: 'Media',
      estado: 'activo',
    },
  });

  const adminA = await prisma.usuario.create({
    data: { empresa_id: empresaA.id, rut: '12812223-0', nombre: 'Administrador de Gestión', email: 'gestion@geoconstanza.cl', password_hash: hashGeo, rol: ROLES.ADMINISTRADOR, estado: 'activo' },
  });
  await prisma.usuario.create({
    data: { empresa_id: empresaA.id, rut: '11111111-1', nombre: 'Operador Central', email: 'admin@geoconstanza.cl', password_hash: hashGeo, rol: ROLES.OPERADOR_CENTRAL, estado: 'activo' },
  });
  const supervisorA = await prisma.usuario.create({
    data: { empresa_id: empresaA.id, rut: '15678901-2', nombre: 'Andrés Martínez', email: 'supervisor@geoconstanza.cl', password_hash: hashGeo, rol: ROLES.SUPERVISOR, instalacion_asignada_id: instalacionA.id, estado: 'activo' },
  });
  await prisma.supervisor_Instalacion.create({
    data: { empresa_id: empresaA.id, supervisor_id: supervisorA.id, instalacion_id: instalacionA.id },
  });
  const guardiaA = await prisma.usuario.create({
    data: {
      empresa_id: empresaA.id, rut: '20570418-3', nombre: 'Víctor Norambuena', email: 'pauta@geoconstanza.cl', password_hash: hashGeo,
      rol: ROLES.GGSS_EN_PAUTA, tipo_ggss: 'pauta', instalacion_asignada_id: instalacionA.id,
      imei_dispositivo: 'TABLET_PROV_01', dispositivo_principal: 'tablet_empresa', estado: 'activo',
    },
  });
  await prisma.usuario.create({
    data: {
      empresa_id: empresaA.id, rut: '19234567-8', nombre: 'M. López', email: 'libre@geoconstanza.cl', password_hash: hashGeo,
      rol: ROLES.GGSS_LIBRE, tipo_ggss: 'libre', instalacion_asignada_id: instalacionA.id, dispositivo_principal: 'mobil_personal', estado: 'activo',
    },
  });

  // 4. EMPRESA B — datos propios y distintos, para comprobar el aislamiento
  const empresaB = await crearEmpresa({ nombre: 'Vigilancia Beta S.A.', rut: rutDe(77222222), plan: 'estandar' });

  const instalacionB = await prisma.instalacion.create({
    data: {
      empresa_id: empresaB.id,
      nombre: 'BODEGA BETA CENTRO',
      direccion: 'Alameda 1234, Santiago',
      latitud: CENTRO_LAT,
      longitud: CENTRO_LON,
      radio_geofence_m: 120,
      tipo_recinto: 'Industrial',
      nivel_criticidad: 'Alta',
      estado: 'activo',
    },
  });

  const adminB = await prisma.usuario.create({
    data: { empresa_id: empresaB.id, rut: rutDe(21000001), nombre: 'Admin Beta', email: 'gestion@beta.cl', password_hash: hashGeo, rol: ROLES.ADMINISTRADOR, estado: 'activo' },
  });
  const supervisorB = await prisma.usuario.create({
    data: { empresa_id: empresaB.id, rut: rutDe(21000002), nombre: 'Carolina Ruiz', email: 'supervisor@beta.cl', password_hash: hashGeo, rol: ROLES.SUPERVISOR, instalacion_asignada_id: instalacionB.id, estado: 'activo' },
  });
  await prisma.supervisor_Instalacion.create({
    data: { empresa_id: empresaB.id, supervisor_id: supervisorB.id, instalacion_id: instalacionB.id },
  });
  const guardiaB = await prisma.usuario.create({
    data: {
      empresa_id: empresaB.id, rut: rutDe(21000003), nombre: 'Rodrigo Vera', email: 'pauta@beta.cl', password_hash: hashGeo,
      rol: ROLES.GGSS_EN_PAUTA, tipo_ggss: 'pauta', instalacion_asignada_id: instalacionB.id,
      dispositivo_principal: 'mobil_empresa', estado: 'activo',
    },
  });

  console.log('✅ Empresas, instalaciones y usuarios creados con éxito.');

  // 5. Un turno para hoy por empresa, y una novedad por empresa
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);

  const turnoA = await prisma.turno.create({
    data: { empresa_id: empresaA.id, usuario_id: guardiaA.id, instalacion_id: instalacionA.id, fecha: hoy, hora_inicio: '08:00', hora_fin: '20:00', tipo_turno: 'normal', estado: 'programado', creado_por: adminA.id },
  });
  const turnoB = await prisma.turno.create({
    data: { empresa_id: empresaB.id, usuario_id: guardiaB.id, instalacion_id: instalacionB.id, fecha: hoy, hora_inicio: '08:00', hora_fin: '20:00', tipo_turno: 'normal', estado: 'programado', creado_por: adminB.id },
  });
  await crearNovedad(empresaA, { usuario: guardiaA, instalacion: instalacionA, turno: turnoA, tipo: 'Ronda', descripcion: 'Ronda perimetral sin novedades (Alfa)', urgencia: 'verde' });
  await crearNovedad(empresaB, { usuario: guardiaB, instalacion: instalacionB, turno: turnoB, tipo: 'Intrusión', descripcion: 'Portón forzado en acceso sur (Beta)', urgencia: 'rojo' });

  console.log('\n📋 CREDENCIALES FINALES PARA LA DEMO (contraseña de todas: geo2026)');
  console.log('--------------------------------------------------');
  console.log('PLATAFORMA (super admin) : plataforma@geoconstanza.cl');
  console.log('--- Empresa A: Seguridad Alfa Ltda. ---');
  console.log('ADMIN (Gestión)   : gestion@geoconstanza.cl');
  console.log('CENTRAL (Mapa)    : admin@geoconstanza.cl');
  console.log('SUPERVISOR        : supervisor@geoconstanza.cl');
  console.log('PAUTA (Víctor)    : pauta@geoconstanza.cl');
  console.log('LIBRE             : libre@geoconstanza.cl');
  console.log('--- Empresa B: Vigilancia Beta S.A. ---');
  console.log('ADMIN (Gestión)   : gestion@beta.cl');
  console.log('SUPERVISOR        : supervisor@beta.cl');
  console.log('PAUTA             : pauta@beta.cl');
  console.log('--------------------------------------------------');
  console.log('(el login es por RUT; ver el panel de credenciales de demostración)');
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
