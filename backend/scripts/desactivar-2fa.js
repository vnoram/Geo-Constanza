#!/usr/bin/env node
/**
 * Desactiva el segundo factor (2FA) de un usuario por RUT.
 * Uso de EMERGENCIA: solo con acceso al servidor (por ejemplo, si el único administrador perdió su dispositivo
 * y sus códigos de recuperación).
 *
 *   node scripts/desactivar-2fa.js <rut>
 *
 * Tras ejecutarlo, el usuario vuelve a iniciar sesión solo con contraseña y debe enrolar 2FA de nuevo.
 */
require('dotenv').config();
const { prisma } = require('../src/config/database');

const main = async () => {
  const rut = process.argv[2];
  if (!rut) {
    console.error('Uso: node scripts/desactivar-2fa.js <rut>');
    process.exitCode = 1;
    return;
  }
  const usuario = await prisma.usuario.findUnique({ where: { rut } });
  if (!usuario) {
    console.error(`No existe un usuario con RUT ${rut}.`);
    process.exitCode = 1;
    return;
  }
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { two_factor_enabled: false, two_factor_secret: null, two_factor_recovery: null, two_factor_ultimo_paso: null },
  });
  await prisma.auditoria.create({
    data: {
      usuario_id: usuario.id,
      accion: 'reiniciar_2fa_script',
      tabla_afectada: 'usuarios',
      registro_id: usuario.id,
      user_agent: 'scripts/desactivar-2fa.js',
    },
  });
  console.log(`2FA desactivado para ${usuario.nombre} (${usuario.rol}).`);
};

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); setTimeout(() => process.exit(), 200); });
