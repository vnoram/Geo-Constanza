/**
 * Alcance por empresa: transforma los argumentos de una operación de Prisma para que solo
 * toque filas de la empresa indicada. Es una función PURA (sin base de datos) para poder
 * probarla a fondo; config/database.js la conecta como extensión del cliente.
 *
 * Qué garantiza, por operación:
 *   lecturas (findMany/findFirst/count/aggregate/groupBy)  -> AND empresa_id
 *   findUnique / findUniqueOrThrow / update / delete       -> where único + empresa_id
 *                                                             (un id ajeno "no existe": 404)
 *   updateMany / deleteMany                                -> AND empresa_id
 *   create / createMany / upsert                           -> empresa_id forzado desde el contexto
 *   update / upsert / updateMany                           -> empresa_id NO se puede modificar
 *
 * Lo que NO cubre (y por qué es seguro): el SQL crudo ($queryRaw/$executeRaw) no pasa por
 * aquí (ver docs/MULTIEMPRESA.md, cada uso está justificado); los include/select anidados
 * parten de una fila ya filtrada y las claves foráneas compuestas (empresa_id, id) de la base
 * impiden que una relación apunte a otra empresa.
 */

// Modelos con columna empresa_id. Usuario y Auditoria la tienen nullable (super admin y
// acciones de plataforma): sus filas sin empresa quedan fuera de toda consulta de empresa.
const MODELOS_CON_EMPRESA = new Set([
  'Usuario',
  'Instalacion',
  'Supervisor_Instalacion',
  'Turno',
  'Asistencia',
  'Novedad',
  'NovedadHistorial',
  'Solicitud',
  'Auditoria',
]);

const LECTURAS = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy']);
const POR_CLAVE_UNICA = new Set(['findUnique', 'findUniqueOrThrow', 'delete']);
const MASIVAS = new Set(['updateMany', 'updateManyAndReturn', 'deleteMany']);
const CREACIONES_MASIVAS = new Set(['createMany', 'createManyAndReturn']);

const esObjetoPlano = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && !(v instanceof Date) && !Buffer.isBuffer(v);

/** ¿El `data` de un create usa relaciones (connect/create) en lugar de columnas sueltas? */
const usaRelaciones = (data) => Object.values(data ?? {}).some(
  (v) => esObjetoPlano(v) && ('connect' in v || 'create' in v || 'connectOrCreate' in v),
);

const conEmpresaEnWhere = (where, empresaId) => (where && Object.keys(where).length
  ? { AND: [where, { empresa_id: empresaId }] }
  : { empresa_id: empresaId });

/** where de clave única + empresa: Prisma lo admite ("extendedWhereUnique"). */
const conEmpresaEnWhereUnico = (where, empresaId) => ({ ...(where ?? {}), empresa_id: empresaId });

/** Quita empresa_id (y la relación empresa) de un `data` de actualización: no se puede mover un registro de empresa. */
const sinEmpresaEnData = (data) => {
  if (!esObjetoPlano(data)) return data;
  const resto = { ...data };
  delete resto.empresa_id;
  delete resto.empresa;
  return resto;
};

const asegurarEmpresaEnCreate = (data, empresaId) => {
  if (!esObjetoPlano(data)) return data;
  if (data.empresa_id !== undefined && data.empresa_id !== empresaId) {
    throw Object.assign(new Error('No se puede crear un registro en otra empresa.'), { statusCode: 403, code: 'EMPRESA_AJENA' });
  }
  if (usaRelaciones(data)) {
    const resto = { ...data };
    delete resto.empresa_id;
    return { ...resto, empresa: { connect: { id: empresaId } } };
  }
  return { ...data, empresa_id: empresaId };
};

/** createMany no admite relaciones: siempre va la columna suelta. Rechaza una empresa distinta a la del contexto. */
const filaConEmpresa = (fila, empresaId) => {
  if (fila?.empresa_id !== undefined && fila.empresa_id !== empresaId) {
    throw Object.assign(new Error('No se puede crear un registro en otra empresa.'), { statusCode: 403, code: 'EMPRESA_AJENA' });
  }
  return { ...fila, empresa_id: empresaId };
};

/**
 * @param {string} modelo     nombre del modelo de Prisma ('Turno', 'Supervisor_Instalacion', ...)
 * @param {string} operacion  nombre de la operación ('findMany', 'create', ...)
 * @param {object} args       argumentos originales
 * @param {string} empresaId  empresa del contexto
 * @returns {object} argumentos con el alcance aplicado
 */
function aplicarAlcance(modelo, operacion, args, empresaId) {
  if (!MODELOS_CON_EMPRESA.has(modelo)) return args;
  if (typeof empresaId !== 'string' || !empresaId) {
    throw new Error('aplicarAlcance requiere un empresaId');
  }
  const a = { ...(args ?? {}) };

  if (LECTURAS.has(operacion) || MASIVAS.has(operacion)) {
    a.where = conEmpresaEnWhere(a.where, empresaId);
    if ('data' in a) a.data = sinEmpresaEnData(a.data);
    return a;
  }

  if (POR_CLAVE_UNICA.has(operacion)) {
    a.where = conEmpresaEnWhereUnico(a.where, empresaId);
    return a;
  }

  if (operacion === 'update') {
    a.where = conEmpresaEnWhereUnico(a.where, empresaId);
    a.data = sinEmpresaEnData(a.data);
    return a;
  }

  if (operacion === 'create') {
    a.data = asegurarEmpresaEnCreate(a.data, empresaId);
    return a;
  }

  if (CREACIONES_MASIVAS.has(operacion)) {
    a.data = Array.isArray(a.data)
      ? a.data.map((fila) => filaConEmpresa(fila, empresaId))
      : filaConEmpresa(a.data, empresaId);
    return a;
  }

  if (operacion === 'upsert') {
    a.where = conEmpresaEnWhereUnico(a.where, empresaId);
    a.create = asegurarEmpresaEnCreate(a.create, empresaId);
    a.update = sinEmpresaEnData(a.update);
    return a;
  }

  // Operación desconocida de un modelo con empresa: se rechaza antes que dejarla pasar sin filtro.
  throw new Error(`Operación "${operacion}" sin alcance por empresa definido para ${modelo}`);
}

module.exports = { aplicarAlcance, MODELOS_CON_EMPRESA };
