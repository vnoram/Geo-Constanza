/**
 * Ayudantes para las pruebas con base real (RUN_LOCAL_DB_TESTS=1): crean una empresa desechable y
 * la borran con todo lo que quedó colgando de ella. Usan el cliente GLOBAL a propósito (preparan y
 * limpian datos de varias empresas; no son código de la aplicación).
 */
const { randomUUID } = require('crypto');
const { prismaGlobal } = require('../config/database');
const { calcularDv } = require('../utils/rut');

const rutAleatorio = () => {
  const cuerpo = String(70000000 + Math.floor(Math.random() * 9999999));
  return `${cuerpo}-${calcularDv(cuerpo)}`;
};

const crearEmpresaDePrueba = (nombre = 'Empresa de prueba', extra = {}) => prismaGlobal.empresa.create({
  data: { id: randomUUID(), nombre, rut: rutAleatorio(), ...extra },
});

/** Borra una empresa y todo lo que depende de ella, en el orden que exigen las claves foráneas. */
const borrarEmpresaDePrueba = async (empresaId) => {
  if (!empresaId) return;
  const donde = { empresa_id: empresaId };
  await prismaGlobal.asistencia.deleteMany({ where: donde });
  await prismaGlobal.novedadHistorial.deleteMany({ where: donde });
  await prismaGlobal.novedad.deleteMany({ where: donde });
  await prismaGlobal.solicitud.deleteMany({ where: donde });
  await prismaGlobal.auditoria.deleteMany({ where: donde });
  await prismaGlobal.turno.deleteMany({ where: donde });
  await prismaGlobal.supervisor_Instalacion.deleteMany({ where: donde });
  const usuarios = await prismaGlobal.usuario.findMany({ where: donde, select: { id: true } });
  await prismaGlobal.passwordReset.deleteMany({ where: { usuario_id: { in: usuarios.map((u) => u.id) } } });
  await prismaGlobal.usuario.deleteMany({ where: donde });
  await prismaGlobal.instalacion.deleteMany({ where: donde });
  await prismaGlobal.empresa.deleteMany({ where: { id: empresaId } });
};

module.exports = { crearEmpresaDePrueba, borrarEmpresaDePrueba };
