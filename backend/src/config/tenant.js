/**
 * Contexto de empresa de la petición actual (AsyncLocalStorage).
 *
 * `authenticate` lo fija con la empresa del TOKEN (nunca con algo enviado por el frontend) y
 * todo el código que se ejecuta después, incluidas las promesas y transacciones, lo ve.
 * El cliente `prisma` de config/database.js lo lee para aislar cada consulta por empresa.
 *
 * Trabajo fuera de una petición HTTP (sockets, scripts, seed): no hay contexto. Debe usar
 * `prismaGlobal` de forma explícita, o abrir uno con `conEmpresa(empresaId, fn)`.
 */
const { AsyncLocalStorage } = require('node:async_hooks');

const almacen = new AsyncLocalStorage();

/** Ejecuta `fn` con la empresa indicada como contexto. */
const conEmpresa = (empresaId, fn) => {
  if (typeof empresaId !== 'string' || !empresaId) {
    throw new Error('conEmpresa requiere un empresaId válido');
  }
  return almacen.run({ empresaId }, fn);
};

/** Empresa del contexto actual, o null si no hay (trabajo fuera de una petición o del super admin). */
const empresaActual = () => almacen.getStore()?.empresaId ?? null;

module.exports = { conEmpresa, empresaActual };
