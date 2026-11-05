const { aplicarAlcance, MODELOS_CON_EMPRESA } = require('../tenantScope');
const { conEmpresa, empresaActual } = require('../tenant');

const E = 'empresa-A';
const alcance = (modelo, operacion, args) => aplicarAlcance(modelo, operacion, args, E);

describe('lecturas: findMany / findFirst / count / aggregate / groupBy', () => {
  test.each(['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy'])('%s agrega empresa_id con AND', (op) => {
    expect(alcance('Turno', op, { where: { estado: 'programado' } }).where)
      .toEqual({ AND: [{ estado: 'programado' }, { empresa_id: E }] });
  });

  test.each(['findMany', 'count', 'aggregate', 'groupBy'])('%s sin where también queda filtrada', (op) => {
    expect(alcance('Novedad', op, undefined).where).toEqual({ empresa_id: E });
    expect(alcance('Novedad', op, { where: {} }).where).toEqual({ empresa_id: E });
  });

  test('un OR del llamador no puede escapar del filtro de empresa', () => {
    const where = alcance('Usuario', 'findMany', { where: { OR: [{ rol: 'admin' }, { rol: 'pauta' }] } }).where;
    expect(where).toEqual({ AND: [{ OR: [{ rol: 'admin' }, { rol: 'pauta' }] }, { empresa_id: E }] });
  });

  test('un where que intenta fijar OTRA empresa sigue encerrado en la del contexto', () => {
    const where = alcance('Turno', 'findMany', { where: { empresa_id: 'empresa-B' } }).where;
    expect(where).toEqual({ AND: [{ empresa_id: 'empresa-B' }, { empresa_id: E }] }); // ambas deben cumplirse: no devuelve nada
  });

  test('conserva el resto de los argumentos (orden, paginación, include, select)', () => {
    const args = { where: { estado: 'x' }, orderBy: { created_at: 'desc' }, skip: 10, take: 5, include: { usuario: true } };
    expect(alcance('Turno', 'findMany', args)).toMatchObject({ orderBy: args.orderBy, skip: 10, take: 5, include: args.include });
  });

  test('no modifica los argumentos originales', () => {
    const args = { where: { estado: 'x' } };
    alcance('Turno', 'findMany', args);
    expect(args).toEqual({ where: { estado: 'x' } });
  });
});

describe('por id: findUnique / update / delete (un id ajeno "no existe")', () => {
  test.each(['findUnique', 'findUniqueOrThrow', 'delete'])('%s agrega empresa_id al where único', (op) => {
    expect(alcance('Instalacion', op, { where: { id: 'i1' } }).where).toEqual({ id: 'i1', empresa_id: E });
  });

  test('update agrega empresa_id al where único', () => {
    expect(alcance('Turno', 'update', { where: { id: 't1' }, data: { estado: 'cancelado' } }).where).toEqual({ id: 't1', empresa_id: E });
  });

  test('una clave única compuesta se conserva y recibe empresa_id', () => {
    const where = alcance('Supervisor_Instalacion', 'findUnique', { where: { supervisor_id_instalacion_id: { supervisor_id: 's', instalacion_id: 'i' } } }).where;
    expect(where).toEqual({ supervisor_id_instalacion_id: { supervisor_id: 's', instalacion_id: 'i' }, empresa_id: E });
  });

  test('un llamador que pone OTRA empresa en el where único es sobrescrito por la del contexto', () => {
    expect(alcance('Turno', 'findUnique', { where: { id: 't1', empresa_id: 'empresa-B' } }).where).toEqual({ id: 't1', empresa_id: E });
    expect(alcance('Turno', 'delete', { where: { id: 't1', empresa_id: 'empresa-B' } }).where).toEqual({ id: 't1', empresa_id: E });
  });
});

describe('create / createMany', () => {
  test('create fuerza la empresa del contexto', () => {
    expect(alcance('Turno', 'create', { data: { usuario_id: 'u', instalacion_id: 'i' } }).data)
      .toEqual({ usuario_id: 'u', instalacion_id: 'i', empresa_id: E });
  });

  test('create rechaza crear en OTRA empresa (403)', () => {
    expect(() => alcance('Turno', 'create', { data: { empresa_id: 'empresa-B' } })).toThrow(expect.objectContaining({ code: 'EMPRESA_AJENA', statusCode: 403 }));
  });

  test('create con la MISMA empresa explícita es válido', () => {
    expect(alcance('Turno', 'create', { data: { empresa_id: E, usuario_id: 'u' } }).data.empresa_id).toBe(E);
  });

  test('create con sintaxis de relación (connect) usa la relación empresa, nunca mezcla con la columna', () => {
    const data = alcance('Novedad', 'create', { data: { tipo: 'x', usuario: { connect: { id: 'u' } } } }).data;
    expect(data.empresa).toEqual({ connect: { id: E } });
    expect(data).not.toHaveProperty('empresa_id');
  });

  test('createMany con arreglo asigna la empresa a CADA fila', () => {
    const data = alcance('Supervisor_Instalacion', 'createMany', { data: [{ supervisor_id: 's1', instalacion_id: 'i1' }, { supervisor_id: 's2', instalacion_id: 'i1' }], skipDuplicates: true });
    expect(data.data).toEqual([
      { supervisor_id: 's1', instalacion_id: 'i1', empresa_id: E },
      { supervisor_id: 's2', instalacion_id: 'i1', empresa_id: E },
    ]);
    expect(data.skipDuplicates).toBe(true);
  });

  test('createMany rechaza si UNA sola fila pide otra empresa', () => {
    expect(() => alcance('Turno', 'createMany', { data: [{ usuario_id: 'a' }, { usuario_id: 'b', empresa_id: 'empresa-B' }] }))
      .toThrow(expect.objectContaining({ code: 'EMPRESA_AJENA' }));
  });

  test('createMany con un objeto único también lleva la empresa', () => {
    expect(alcance('Turno', 'createMany', { data: { usuario_id: 'a' } }).data).toEqual({ usuario_id: 'a', empresa_id: E });
  });

  test('createManyAndReturn se trata igual que createMany', () => {
    expect(alcance('Turno', 'createManyAndReturn', { data: [{ usuario_id: 'a' }] }).data).toEqual([{ usuario_id: 'a', empresa_id: E }]);
  });
});

describe('update / updateMany / deleteMany / upsert', () => {
  test('updateMany y deleteMany se limitan a la empresa', () => {
    expect(alcance('Turno', 'updateMany', { where: { estado: 'x' }, data: { estado: 'y' } }).where).toEqual({ AND: [{ estado: 'x' }, { empresa_id: E }] });
    expect(alcance('Turno', 'deleteMany', { where: { instalacion_id: 'i' } }).where).toEqual({ AND: [{ instalacion_id: 'i' }, { empresa_id: E }] });
    expect(alcance('Turno', 'deleteMany', undefined).where).toEqual({ empresa_id: E });
  });

  test.each(['update', 'updateMany'])('%s NO permite mover un registro a otra empresa (se descarta empresa_id)', (op) => {
    expect(alcance('Turno', op, { where: { id: 't' }, data: { estado: 'y', empresa_id: 'empresa-B' } }).data).toEqual({ estado: 'y' });
  });

  test('update tampoco permite cambiar la relación empresa', () => {
    expect(alcance('Turno', 'update', { where: { id: 't' }, data: { estado: 'y', empresa: { connect: { id: 'empresa-B' } } } }).data).toEqual({ estado: 'y' });
  });

  test('upsert: where único con empresa, create con empresa y update sin empresa_id', () => {
    const r = alcance('Instalacion', 'upsert', {
      where: { id: 'i1' }, create: { nombre: 'Nueva' }, update: { nombre: 'Editada', empresa_id: 'empresa-B' },
    });
    expect(r.where).toEqual({ id: 'i1', empresa_id: E });
    expect(r.create).toEqual({ nombre: 'Nueva', empresa_id: E });
    expect(r.update).toEqual({ nombre: 'Editada' });
  });

  test('upsert rechaza un create que pide otra empresa', () => {
    expect(() => alcance('Instalacion', 'upsert', { where: { id: 'i' }, create: { empresa_id: 'empresa-B' }, update: {} }))
      .toThrow(expect.objectContaining({ code: 'EMPRESA_AJENA' }));
  });
});

describe('include / select anidados', () => {
  test('se conservan intactos: parten de una fila ya filtrada y las claves foráneas compuestas impiden relaciones entre empresas', () => {
    const include = { usuario: { select: { id: true, nombre: true } }, instalacion: true };
    const r = alcance('Turno', 'findMany', { where: { estado: 'x' }, include });
    expect(r.include).toEqual(include);
    expect(r.where).toEqual({ AND: [{ estado: 'x' }, { empresa_id: E }] });
  });

  test('un include no puede cambiar el filtro del modelo raíz', () => {
    const r = alcance('Novedad', 'findFirst', { include: { instalacion: { where: { empresa_id: 'empresa-B' } } } });
    expect(r.where).toEqual({ empresa_id: E });
  });
});

describe('modelos y operaciones', () => {
  test('cubre exactamente los modelos con empresa del esquema', () => {
    expect([...MODELOS_CON_EMPRESA].sort()).toEqual(
      ['Asistencia', 'Auditoria', 'Instalacion', 'Novedad', 'NovedadHistorial', 'Solicitud', 'Supervisor_Instalacion', 'Turno', 'Usuario'],
    );
  });

  test('un modelo sin empresa (Empresa, PasswordReset) pasa sin cambios', () => {
    const args = { where: { id: 'x' } };
    expect(aplicarAlcance('Empresa', 'findMany', args, E)).toBe(args);
    expect(aplicarAlcance('PasswordReset', 'create', args, E)).toBe(args);
  });

  test('una operación desconocida de un modelo con empresa se rechaza antes que dejarla sin filtro', () => {
    expect(() => alcance('Turno', 'operacionNueva', {})).toThrow(/sin alcance por empresa/);
  });

  test('sin empresaId lanza error (falla cerrado)', () => {
    expect(() => aplicarAlcance('Turno', 'findMany', {}, undefined)).toThrow(/empresaId/);
    expect(() => aplicarAlcance('Turno', 'findMany', {}, '')).toThrow(/empresaId/);
  });
});

describe('contexto de empresa (AsyncLocalStorage)', () => {
  test('conEmpresa fija la empresa para todo lo asíncrono que se ejecuta dentro', async () => {
    const vista = await conEmpresa('e1', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Promise.all([Promise.resolve().then(empresaActual), new Promise((r) => setImmediate(() => r(empresaActual())))]);
    });
    expect(vista).toEqual(['e1', 'e1']);
  });

  test('fuera de conEmpresa no hay empresa', () => {
    expect(empresaActual()).toBeNull();
  });

  test('peticiones simultáneas de empresas distintas NO se mezclan', async () => {
    const lectura = (empresa, ms) => conEmpresa(empresa, async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return empresaActual();
    });
    const resultados = await Promise.all([lectura('A', 20), lectura('B', 5), lectura('C', 10), lectura('A', 1)]);
    expect(resultados).toEqual(['A', 'B', 'C', 'A']);
  });

  test('conEmpresa exige una empresa válida', () => {
    expect(() => conEmpresa('', () => 1)).toThrow();
    expect(() => conEmpresa(null, () => 1)).toThrow();
  });
});
