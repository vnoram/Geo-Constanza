jest.mock('../../config/database', () => ({ prisma: {
  usuario: { findUnique: jest.fn() },
  turno: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
  asistencia: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
  solicitud: { findFirst: jest.fn(), findMany: jest.fn() },
  novedad: { count: jest.fn() },
  $transaction: jest.fn(), $executeRaw: jest.fn(),
} }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn() }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn(), exigirAlcanceInstalacion: jest.fn() }));
const { prisma } = require('../../config/database');
const { instanteChile } = require('../../utils/fechaChile');
const turnos = require('../turnos.service');
const asistencia = require('../asistencia.service');
const solicitudes = require('../solicitudes.service');
const { getDashboardHoy } = require('../dashboard.service');
const { getSocketIO } = require('../../socket/socketManager');
const { TIPOS_COBERTURA } = require('../../constants/solicitudes');

const inst = { id: 'i', nombre: 'Instalación Norte' };
const turno = (id, fecha, hora_inicio, hora_fin, extra = {}) => ({
  id, fecha: new Date(`${fecha}T00:00:00Z`), hora_inicio, hora_fin,
  usuario_id: 'u', instalacion_id: 'i', instalacion: inst, estado: 'programado', ...extra,
});
const a = turno('A', '2026-09-26', '20:00', '08:00');
const b = turno('B', '2026-09-27', '00:00', '14:00');
const abierta = (t) => ({ id: `as-${t.id}`, turno_id: t.id, usuario_id: 'u', instalacion_id: t.instalacion_id,
  turno: t, hora_entrada: instanteChile(new Date(t.fecha).toISOString().slice(0, 10), t.hora_inicio), hora_salida: null });
const entrada = () => asistencia.registrarEntrada({ instalacion_id: 'i', metodo: 'tablet' }, { id: 'u' });
let emit;
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers().setSystemTime(instanteChile('2026-09-27', '00:21'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  prisma.$transaction.mockImplementation((cb) => typeof cb === 'function' ? cb(prisma) : Promise.all(cb));
  prisma.$executeRaw.mockResolvedValue(1);
  prisma.turno.findMany.mockResolvedValue([]);
  prisma.usuario.findUnique.mockResolvedValue({ instalacion_asignada_id: null });
  prisma.asistencia.findMany.mockResolvedValue([]);
  prisma.solicitud.findFirst.mockResolvedValue(null);
  prisma.solicitud.findMany.mockResolvedValue([]);
  prisma.novedad.count.mockResolvedValue(1);
  prisma.asistencia.create.mockImplementation(async ({ data }) => ({ id: 'nueva', ...data }));
  prisma.asistencia.update.mockImplementation(async ({ data }) => data);
  prisma.turno.create.mockImplementation(async ({ data }) => data);
  prisma.turno.update.mockImplementation(async ({ data }) => data);
  emit = jest.fn();
  getSocketIO.mockReturnValue({ emit, to: () => ({ emit }) });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('crear rechaza solapamiento de días distintos e informa fecha, horario e instalación', async () => {
  prisma.turno.findMany.mockResolvedValue([a]);
  await expect(turnos.crear(b, 'admin')).rejects.toMatchObject({ statusCode: 409,
    message: expect.stringContaining('2026-09-26 20:00–08:00 en Instalación Norte') });
  expect(prisma.turno.findMany.mock.calls[0][0].where).toMatchObject({ usuario_id: 'u',
    fecha: { gte: new Date('2026-09-26T00:00:00Z'), lte: new Date('2026-09-28T00:00:00Z') }, estado: { not: 'cancelado' } });
  expect(prisma.turno.create).not.toHaveBeenCalled();
});
test('crear detecta también choque con el día siguiente', async () => {
  prisma.turno.findMany.mockResolvedValue([b]);
  await expect(turnos.crear(a, 'admin')).rejects.toMatchObject({ statusCode: 409 });
});
test.each([
  [turno('C', '2026-09-27', '06:00', '14:00'), turno('D', '2026-09-27', '14:00', '22:00')],
  [a, turno('D', '2026-09-27', '20:00', '08:00')],
])('crear permite contiguos y noches consecutivas', async (previo, nuevo) => {
  prisma.turno.findMany.mockResolvedValue([previo]);
  await expect(turnos.crear(nuevo, 'admin')).resolves.toMatchObject({ id: nuevo.id });
});
test('editar excluye su id y conserva horario sin conflicto', async () => {
  prisma.turno.findUniqueOrThrow.mockResolvedValue(a);
  prisma.turno.findMany.mockImplementation(async ({ where }) => [a].filter((t) => t.id !== where.id.not));
  await expect(turnos.editar('A', { hora_inicio: '20:00' }, { rol: 'administrador' })).resolves.toHaveProperty('turno');
  expect(prisma.turno.findMany.mock.calls[0][0].where.id).toEqual({ not: 'A' });
});
test('lote detecta conflicto con el turno anterior del mismo lote', async () => {
  const almacenados = [];
  prisma.turno.findMany.mockImplementation(async () => almacenados);
  prisma.turno.create.mockImplementation(async ({ data }) => { almacenados.push(data); return data; });
  const resultado = await turnos.crearLote([a, b], 'admin');
  expect(resultado.map((r) => r.success)).toEqual([true, false]);
});
test('pauta 4x4 omite choque con nocturno de ayer', async () => {
  prisma.turno.findMany.mockImplementation(async ({ where }) => a.fecha >= where.fecha.gte && a.fecha <= where.fecha.lte ? [a] : []);
  const resultado = await turnos.crearPauta4x4({ usuario_id: 'u', instalacion_id: 'i', fecha_inicio: '2026-09-27', hora_inicio: '00:00', hora_fin: '14:00' }, 'admin');
  expect(resultado).toMatchObject({ creados: 91, omitidos: 1 });
  expect(resultado.detalles_omitidos[0].motivo).toContain('2026-09-26');
});

test('pauta 4x4 proyecta 6 meses: 92 turnos en 184 días', async () => {
  prisma.turno.findMany.mockResolvedValue([]);
  const resultado = await turnos.crearPauta4x4({ usuario_id: 'u', instalacion_id: 'i', fecha_inicio: '2026-09-27', hora_inicio: '19:00', hora_fin: '07:00' }, 'admin');
  expect(resultado).toMatchObject({ creados: 92, omitidos: 0 });
  const fechas = prisma.turno.create.mock.calls.map(([{ data }]) => data.fecha.toISOString().slice(0, 10));
  expect(fechas[0]).toBe('2026-09-27');
  expect(fechas[91]).toBe('2027-03-25'); // último día de trabajo del ciclo 23
});

test('pauta 4x4 con reemplazar borra el rango completo de 6 meses', async () => {
  prisma.turno.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  prisma.turno.findMany.mockResolvedValue([]);
  await turnos.crearPauta4x4({ usuario_id: 'u', instalacion_id: 'i', fecha_inicio: '2026-09-27', hora_inicio: '19:00', hora_fin: '07:00', reemplazar: true }, 'admin');
  const { fecha } = prisma.turno.deleteMany.mock.calls[0][0].where;
  expect(fecha.gte.toISOString().slice(0, 10)).toBe('2026-09-27');
  expect(fecha.lte.toISOString().slice(0, 10)).toBe('2027-03-29'); // 184 días desde el inicio
});

test('pauta 4x4 solo en la instalación asignada del guardia', async () => {
  prisma.usuario.findUnique.mockResolvedValue({ instalacion_asignada_id: 'otra' });
  await expect(turnos.crearPauta4x4({ usuario_id: 'u', instalacion_id: 'i', fecha_inicio: '2026-09-27', hora_inicio: '19:00', hora_fin: '07:00' }, 'admin'))
    .rejects.toMatchObject({ statusCode: 400 });
  expect(prisma.turno.create).not.toHaveBeenCalled();
});

test('entrada de respaldo: un GGSS sin pauta ni turno aprobado recibe 403', async () => {
  prisma.turno.count.mockResolvedValue(0);
  prisma.solicitud.findFirst.mockResolvedValue(null);
  await expect(asistencia.registrarEntradaFallback({ instalacion_id: 'i' }, { id: 'u', rol: 'ggss' }))
    .rejects.toMatchObject({ statusCode: 403 });
});

test('tienePautaVigente: hay turnos programados de hoy en adelante', async () => {
  prisma.turno.count.mockResolvedValueOnce(3).mockResolvedValueOnce(0);
  await expect(turnos.tienePautaVigente('u')).resolves.toBe(true);
  await expect(turnos.tienePautaVigente('u')).resolves.toBe(false);
  expect(prisma.turno.count.mock.calls[0][0].where).toMatchObject({ usuario_id: 'u', estado: 'programado' });
});

test.each([['00:21', 21, 'tardio'], ['00:15', 15, 'normal'], ['00:16', 16, 'tardio']])('entrada %s calcula %i minutos', async (hora, minutos, estado) => {
  jest.setSystemTime(instanteChile('2026-09-27', hora));
  prisma.turno.findMany.mockResolvedValue([b]);
  await expect(entrada()).resolves.toMatchObject({ turno_id: 'B', minutos_retraso: minutos, estado });
  expect(emit).toHaveBeenCalledWith('admin:dashboard_update', { entity: 'asistencia' });
});
test('entrada nocturna 21:41 elige A y calcula 101 minutos', async () => {
  jest.setSystemTime(instanteChile('2026-09-26', '21:41'));
  prisma.turno.findMany.mockResolvedValue([b, a]);
  await expect(entrada()).resolves.toMatchObject({ turno_id: 'A', minutos_retraso: 101, estado: 'tardio' });
});
test('entrada a las 22:00 Chile elige el turno del 3-oct y marca atraso', async () => {
  const turnoCorrecto = turno('noche-3', '2026-10-03', '19:00', '07:00');
  const turnoManana = turno('noche-4', '2026-10-04', '19:00', '07:00');
  jest.setSystemTime(new Date('2026-10-04T01:00:00.000Z'));
  prisma.turno.findMany.mockResolvedValue([turnoManana, turnoCorrecto]);
  await expect(entrada()).resolves.toMatchObject({
    turno_id: 'noche-3', minutos_retraso: 180, estado: 'tardio',
  });
});
test('entrada a las 22:00 Chile no acepta el turno que comienza el 4-oct', async () => {
  const turnoManana = turno('noche-4', '2026-10-04', '19:00', '07:00');
  jest.setSystemTime(new Date('2026-10-04T01:00:00.000Z'));
  prisma.turno.findMany.mockResolvedValue([turnoManana]);
  await expect(entrada()).rejects.toMatchObject({ statusCode: 400 });
});
test('solicitud aprobada consulta el 3-oct a las 22:00 Chile, no el día UTC siguiente', async () => {
  jest.setSystemTime(new Date('2026-10-04T01:00:00.000Z'));
  prisma.solicitud.findFirst.mockResolvedValue({ id: 'solicitud' });
  await expect(solicitudes.tieneturnoAprobadoHoy('u')).resolves.toBe(true);
  expect(prisma.solicitud.findFirst).toHaveBeenCalledWith({ where: {
    usuario_id: 'u', tipo: { in: TIPOS_COBERTURA }, estado: 'aprobada',
    fecha_desde: { lte: new Date('2026-10-03T00:00:00.000Z') },
    OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: new Date('2026-10-03T00:00:00.000Z') } }],
  } });
});
test('sin asistencia prefiere el turno que empezó antes y advierte el solapamiento', async () => {
  prisma.turno.findMany.mockResolvedValue([b, a]);
  await expect(entrada()).resolves.toMatchObject({ turno_id: 'A' });
  expect(console.warn).toHaveBeenCalled();
});
test('asistencia del turno elegible tiene prioridad y es idempotente', async () => {
  prisma.turno.findMany.mockResolvedValue([a, b]);
  prisma.asistencia.findMany.mockResolvedValue([abierta(b)]);
  await expect(entrada()).resolves.toMatchObject({ id: 'as-B' });
  expect(prisma.asistencia.create).not.toHaveBeenCalled();
});
test('entrada en otra instalación con asistencia A abierta devuelve 409', async () => {
  prisma.turno.findMany.mockResolvedValue([b]);
  prisma.asistencia.findMany.mockResolvedValue([abierta({ ...a, instalacion_id: 'otra' })]);
  await expect(entrada()).rejects.toMatchObject({ statusCode: 409 });
  expect(prisma.asistencia.create).not.toHaveBeenCalled();
});
test('entrada olvidada de un turno terminado se cierra a la hora de término y permite la nueva entrada', async () => {
  prisma.turno.findMany.mockResolvedValue([b]);
  prisma.asistencia.findMany.mockResolvedValue([abierta(turno('vieja', '2026-09-25', '20:00', '08:00'))]);
  await expect(entrada()).resolves.toMatchObject({ turno_id: 'B', minutos_retraso: 21 });
  expect(prisma.asistencia.update).toHaveBeenCalledWith({ where: { id: 'as-vieja' }, data: {
    hora_salida: instanteChile('2026-09-26', '08:00'), metodo_salida: 'cierre_automatico',
    horas_trabajadas: 12, horas_extra: 0 } });
  expect(prisma.asistencia.create).toHaveBeenCalledTimes(1);
});
test('dentro del margen de 2 h la entrada anterior no se cierra sola: 409', async () => {
  jest.setSystemTime(instanteChile('2026-09-27', '09:30'));
  const c = turno('C', '2026-09-27', '09:00', '17:00');
  prisma.turno.findMany.mockResolvedValue([c]);
  prisma.asistencia.findMany.mockResolvedValue([abierta(a)]);
  await expect(entrada()).rejects.toMatchObject({ statusCode: 409 });
  expect(prisma.asistencia.update).not.toHaveBeenCalled();
});
test('pasado el margen de 2 h se cierra la entrada anterior y se abre la nueva', async () => {
  jest.setSystemTime(instanteChile('2026-09-27', '10:01'));
  const c = turno('C', '2026-09-27', '10:00', '18:00');
  prisma.turno.findMany.mockResolvedValue([c]);
  prisma.asistencia.findMany.mockResolvedValue([abierta(a)]);
  await expect(entrada()).resolves.toMatchObject({ turno_id: 'C' });
  expect(prisma.asistencia.update.mock.calls[0][0].data).toMatchObject({
    hora_salida: instanteChile('2026-09-27', '08:00'), metodo_salida: 'cierre_automatico' });
});
test('dos solicitudes concurrentes solo crean una asistencia bajo el bloqueo transaccional', async () => {
  const guardadas = [];
  let cola = Promise.resolve();
  prisma.$transaction.mockImplementation((cb) => {
    const siguiente = cola.then(() => cb(prisma));
    cola = siguiente.catch(() => {});
    return siguiente;
  });
  prisma.asistencia.findMany.mockImplementation(async () => guardadas);
  prisma.asistencia.create.mockImplementation(async ({ data }) => {
    const nueva = { id: 'única', ...data }; guardadas.push(nueva); return nueva;
  });
  prisma.turno.findMany.mockResolvedValue([b]);
  const resultados = await Promise.all([entrada(), entrada()]);
  expect(resultados.map((r) => r.id)).toEqual(['única', 'única']);
  expect(prisma.asistencia.create).toHaveBeenCalledTimes(1);
  expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.asistencia.findMany.mock.invocationCallOrder[0]);
});
test('entrada anticipada dentro de tolerancia: cero minutos', async () => {
  jest.setSystemTime(instanteChile('2026-09-26', '23:45'));
  prisma.turno.findMany.mockResolvedValue([b]);
  await expect(entrada()).resolves.toMatchObject({ minutos_retraso: 0, estado: 'normal' });
});
test.each([['2026-09-26', '23:44'], ['2026-09-27', '14:00']])('no permite entrada fuera de intervalo %s %s', async (fecha, hora) => {
  jest.setSystemTime(instanteChile(fecha, hora));
  prisma.turno.findMany.mockResolvedValue([b]);
  await expect(entrada()).rejects.toMatchObject({ statusCode: 400 });
});
test('salida nocturna a 08:30 suma media hora extra', async () => {
  jest.setSystemTime(instanteChile('2026-09-27', '08:30'));
  prisma.asistencia.findUniqueOrThrow.mockResolvedValue(abierta(a));
  await expect(asistencia.registrarSalida({ asistencia_id: 'as-A', metodo: 'tablet' }, { id: 'u' })).resolves.toMatchObject({ horas_extra: 0.5, horas_trabajadas: 12.5 });
});
test('salida sin reporte del turno: 409 y no cierra la asistencia', async () => {
  prisma.asistencia.findUniqueOrThrow.mockResolvedValue(abierta(a));
  prisma.novedad.count.mockResolvedValue(0);
  await expect(asistencia.registrarSalida({ asistencia_id: 'as-A', metodo: 'tablet' }, { id: 'u' }))
    .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('reporte del turno') });
  expect(prisma.novedad.count).toHaveBeenCalledWith({ where: { turno_id: 'A' } });
  expect(prisma.asistencia.update).not.toHaveBeenCalled();
});
test('estado cierra la entrada olvidada, informa el cierre y devuelve el turno vigente', async () => {
  const vieja = turno('vieja', '2026-09-25', '20:00', '08:00');
  prisma.asistencia.findMany.mockResolvedValue([abierta(vieja), abierta(a)]);
  await expect(asistencia.obtenerEstadoActual('u')).resolves.toMatchObject({
    activo: true, turno_id: 'A', turno: { estado: 'programado' },
    cerradas_automaticamente: [{ asistencia_id: 'as-vieja', fecha: '2026-09-25', hora_inicio: '20:00', hora_fin: '08:00' }] });
  expect(prisma.asistencia.update).toHaveBeenCalledTimes(1);
  expect(prisma.asistencia.update.mock.calls[0][0].where).toEqual({ id: 'as-vieja' });
});
test('salida de la asistencia de otro guardia: 403', async () => {
  prisma.asistencia.findUniqueOrThrow.mockResolvedValue(abierta(a));
  await expect(asistencia.registrarSalida({ asistencia_id: 'as-A' }, { id: 'otro', rol: 'ggss' }))
    .rejects.toMatchObject({ statusCode: 403 });
  expect(prisma.asistencia.update).not.toHaveBeenCalled();
});
test('salida de una asistencia ya cerrada automáticamente: 409', async () => {
  prisma.asistencia.findUniqueOrThrow.mockResolvedValue({ ...abierta(a),
    hora_salida: instanteChile('2026-09-27', '08:00'), metodo_salida: 'cierre_automatico' });
  await expect(asistencia.registrarSalida({ asistencia_id: 'as-A' }, { id: 'u' }))
    .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('automáticamente') });
});
test('estado con dos turnos vigentes prefiere el que empezó antes', async () => {
  prisma.asistencia.findMany.mockResolvedValue([abierta(b), abierta(a)]);
  await expect(asistencia.obtenerEstadoActual('u')).resolves.toMatchObject({ turno_id: 'A' });
});
test('estado sin entrada devuelve turno vigente, no el más reciente', async () => {
  prisma.turno.findMany.mockResolvedValue([b, a]);
  await expect(asistencia.obtenerEstadoActual('u')).resolves.toMatchObject({ activo: false, turno: { id: 'A' } });
});
test('estado sin vigente devuelve próximo de hoy, no mañana', async () => {
  jest.setSystemTime(instanteChile('2026-09-27', '15:00'));
  const proximo = turno('C', '2026-09-27', '20:00', '08:00');
  prisma.turno.findMany.mockResolvedValue([turno('D', '2026-09-28', '06:00', '14:00'), proximo, b]);
  await expect(asistencia.obtenerEstadoActual('u')).resolves.toMatchObject({ activo: false, turno: { id: 'C' } });
});
test('estado vacío cuando solo hay turnos terminados o de mañana', async () => {
  jest.setSystemTime(instanteChile('2026-09-27', '15:00'));
  prisma.turno.findMany.mockResolvedValue([b, turno('D', '2026-09-28', '06:00', '14:00')]);
  await expect(asistencia.obtenerEstadoActual('u')).resolves.toEqual({ activo: false, turno: null, instalacion: null, cerradas_automaticamente: [] });
});
test('dashboard conserva una fila del nocturno con su asistencia correcta', async () => {
  prisma.turno.findMany.mockResolvedValue([{ ...a, usuario: { nombre: 'Víctor' }, asistencias: [{ ...abierta(a), estado: 'tardio' }] }]);
  const resultado = await getDashboardHoy({ rol: 'test' });
  expect(resultado.total).toBe(1);
  expect(resultado.lista).toEqual([expect.objectContaining({ turno_id: 'A', guardia: 'Víctor', hora_entrada: abierta(a).hora_entrada, estado: 'tardio' })]);
});

test('entrada respeta tolerancia de su instalación en lugar de un margen global', async () => {
  prisma.turno.findMany.mockResolvedValue([{ ...b, instalacion: { ...inst, tolerancia_atraso_minutos: 30 } }]);
  await expect(entrada()).resolves.toMatchObject({ minutos_retraso: 21, estado: 'normal' });
});

test('sincronización offline no puede abrir otro turno ni duplicar un reintento', async () => {
  prisma.turno.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, usuario_id: 'u', instalacion_id: 'i1' }));
  prisma.asistencia.findMany.mockResolvedValue([abierta(a)]);
  const resultado = await asistencia.sincronizarBatch([
    { turno_id: 'B', hora_entrada: '2026-09-27T09:00:00Z', hora_salida: null },
    { turno_id: 'A', hora_entrada: '2026-09-27T09:00:00Z', hora_salida: null },
  ], { id: 'u' });
  expect(resultado).toEqual([
    { success: false, error: expect.stringContaining('entrada abierta') },
    { success: true, id: 'as-A' },
  ]);
  expect(prisma.asistencia.create).not.toHaveBeenCalled();
});

test('sincronización offline: ignora usuario ajeno, campos extra y exige turno propio', async () => {
  prisma.turno.findUnique.mockImplementation(async ({ where }) => (
    where.id === 'AJENO' ? { id: 'AJENO', usuario_id: 'otro', instalacion_id: 'i9' } : { id: 'PROPIO', usuario_id: 'u', instalacion_id: 'i1' }
  ));
  prisma.asistencia.findMany.mockResolvedValue([]);
  prisma.asistencia.create.mockResolvedValue({ id: 'nuevo' });
  const resultado = await asistencia.sincronizarBatch([
    { turno_id: 'AJENO', hora_entrada: '2026-09-27T09:00:00Z' },
    { turno_id: 'PROPIO', usuario_id: 'otro', instalacion_id: 'i9', id: 'forzado', horas_extra: 99, verificacion_gps: 'verificado', hora_entrada: '2026-09-27T09:00:00Z' },
    { turno_id: 'PROPIO', hora_entrada: 'no-es-fecha' },
  ], { id: 'u' });
  expect(resultado.map((r) => r.success)).toEqual([false, true, false]);
  expect(resultado[0].error).toMatch(/no pertenece/);
  const data = prisma.asistencia.create.mock.calls[0][0].data;
  expect(data).toMatchObject({ usuario_id: 'u', instalacion_id: 'i1', turno_id: 'PROPIO', verificacion_gps: 'por_revisar' });
  expect(data).not.toHaveProperty('id');
  expect(data).not.toHaveProperty('horas_extra');
});

test('sincronización offline rechaza listas vacías, enormes o que no son listas', async () => {
  for (const malo of [undefined, 'x', {}, [], new Array(201).fill({})]) {
    await expect(asistencia.sincronizarBatch(malo, { id: 'u' })).rejects.toMatchObject({ statusCode: 400 });
  }
});

test('sincronización offline: una salida sin reporte, con horas invertidas o con error interno se rechaza sin filtrar detalles', async () => {
  prisma.turno.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, usuario_id: 'u', instalacion_id: 'i1' }));
  prisma.asistencia.findMany.mockResolvedValue([]);
  prisma.novedad.count.mockResolvedValue(0);
  const r1 = await asistencia.sincronizarBatch([
    { turno_id: 'A', hora_entrada: '2026-09-27T09:00:00Z', hora_salida: '2026-09-27T17:00:00Z' },
    { turno_id: 'A', hora_entrada: '2026-09-27T09:00:00Z', hora_salida: '2026-09-27T08:00:00Z' },
  ], { id: 'u' });
  expect(r1[0]).toEqual({ success: false, error: expect.stringContaining('reporte del turno') });
  expect(r1[1]).toEqual({ success: false, error: expect.stringContaining('posterior') });
  expect(prisma.asistencia.create).not.toHaveBeenCalled();

  prisma.novedad.count.mockResolvedValue(1);
  prisma.asistencia.create.mockRejectedValue(new Error('Invalid prisma.asistencia.create() invocation: columna secreta'));
  const r2 = await asistencia.sincronizarBatch([{ turno_id: 'A', hora_entrada: '2026-09-27T09:00:00Z' }], { id: 'u' });
  expect(r2[0].error).toBe('No se pudo sincronizar este registro');
});

test('sincronización offline: salida con reporte se guarda y el reintento no duplica', async () => {
  prisma.turno.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, usuario_id: 'u', instalacion_id: 'i1' }));
  prisma.asistencia.findMany.mockResolvedValue([]);
  prisma.novedad.count.mockResolvedValue(1);
  prisma.asistencia.create.mockResolvedValue({ id: 'nuevo' });
  const reg = { turno_id: 'A', hora_entrada: '2026-09-27T09:00:00Z', hora_salida: '2026-09-27T17:00:00Z' };
  expect(await asistencia.sincronizarBatch([reg], { id: 'u' })).toEqual([{ success: true, id: 'nuevo' }]);
  prisma.asistencia.findFirst.mockResolvedValue({ id: 'nuevo' });
  expect(await asistencia.sincronizarBatch([reg], { id: 'u' })).toEqual([{ success: true, id: 'nuevo' }]);
  expect(prisma.asistencia.create).toHaveBeenCalledTimes(1);
});

test('conflictos: el supervisor no ve instalación ni horario de turnos fuera de su alcance', async () => {
  const { resolverInstalacionesSupervisor } = require('../supervisor.helper');
  resolverInstalacionesSupervisor.mockResolvedValue(['i']);
  prisma.turno.findMany.mockResolvedValue([a, { ...b, instalacion_id: 'otra', instalacion: { nombre: 'Secreta' } }]);
  const q = { usuario_id: 'u', fecha: '2026-09-27' };
  const sup = await turnos.verificarConflictosPara(q, { id: 's', rol: 'supervisor' });
  expect(sup).toHaveLength(2);
  expect(sup[0].instalacion_id).toBe('i');
  expect(sup[1]).toEqual({ fuera_de_alcance: true });
  const adm = await turnos.verificarConflictosPara(q, { id: 'x', rol: 'administrador' });
  expect(adm[1].instalacion.nombre).toBe('Secreta');
});

test('entrada en un turno de instalación desactivada se rechaza hasta que lo reasignen', async () => {
  prisma.turno.findMany.mockResolvedValue([{ ...b, instalacion: { ...inst, estado: 'inactivo' } }]);
  await expect(entrada()).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('desactivada') });
  expect(prisma.asistencia.create).not.toHaveBeenCalled();
});

test('turnos por reasignar: el supervisor solo ve sus instalaciones', async () => {
  const { resolverInstalacionesSupervisor } = require('../supervisor.helper');
  resolverInstalacionesSupervisor.mockResolvedValue(['i']);
  prisma.turno.findMany.mockResolvedValue([]);
  await turnos.porReasignar({ id: 's', rol: 'supervisor' });
  expect(prisma.turno.findMany.mock.calls[0][0].where).toMatchObject({ estado: 'programado', instalacion: { estado: 'inactivo' }, instalacion_id: { in: ['i'] } });
  await turnos.porReasignar({ id: 'a', rol: 'admin' });
  expect(prisma.turno.findMany.mock.calls[1][0].where).not.toHaveProperty('instalacion_id');
});
