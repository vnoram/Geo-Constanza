// Escalar avisa a Central en vivo; derivar (asignar) acepta novedades escaladas y /responsables
// lista solo a quienes pueden atender la instalación.
jest.mock('../../config/database', () => ({ prisma: {
  $transaction: jest.fn(),
  novedad: { update: jest.fn(), findUnique: jest.fn() },
  novedadHistorial: { create: jest.fn() },
  usuario: { findUnique: jest.fn(), findMany: jest.fn() },
  instalacion: { findUnique: jest.fn() },
} }));
jest.mock('../../config/tenant', () => ({ empresaActual: () => 'e1', conEmpresa: (_e, fn) => fn() }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn() }));
jest.mock('../../utils/azureStorage', () => ({ generarUrlLectura: jest.fn() }));
jest.mock('../../config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));
jest.mock('../notificacion.service', () => ({ enviarNotificacion: jest.fn() }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn(), exigirAlcanceInstalacion: jest.fn() }));

const { prisma } = require('../../config/database');
const { getSocketIO } = require('../../socket/socketManager');
const { resolverInstalacionesSupervisor } = require('../supervisor.helper');
const service = require('../novedades.service');
const { salaCentral, salaAdmin, salaInstalacion } = require('../../constants/salas');
const { ROLES } = require('../../constants/roles');
const { ESTADO_NOVEDAD, ESTADO_USUARIO } = require('../../constants/estados');

const supervisor = { id: 's1', nombre: 'Andrés', rol: ROLES.SUPERVISOR };
const novedad = (estado) => ({ id: 'n1', instalacion_id: 'i1', tipo: 'Robo', urgencia: 'rojo', descripcion: 'Intrusión', estado });
let emisiones;

beforeEach(() => {
  jest.resetAllMocks();
  emisiones = [];
  getSocketIO.mockReturnValue({ to: (sala) => ({ emit: (evento, datos) => emisiones.push({ sala, evento, datos }) }) });
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  prisma.novedad.findUnique.mockResolvedValue(novedad(ESTADO_NOVEDAD.ABIERTA));
  prisma.novedad.update.mockImplementation(({ data }) => Promise.resolve({ ...novedad(data.estado), ...data }));
  prisma.novedadHistorial.create.mockResolvedValue({});
  prisma.instalacion.findUnique.mockResolvedValue({ id: 'i1', nombre: 'Centro Puente Alto' });
  resolverInstalacionesSupervisor.mockResolvedValue(['i1']);
});

describe('escalar', () => {
  test('avisa en vivo a la sala de Central de su empresa con quién y qué escaló', async () => {
    await service.escalar('n1', supervisor);
    const aviso = emisiones.find((e) => e.evento === 'novedad:escalada_central');
    expect(aviso.sala).toBe(salaCentral('e1'));
    expect(aviso.datos).toMatchObject({
      id: 'n1', tipo: 'Robo', urgencia: 'rojo', descripcion: 'Intrusión',
      instalacion: { id: 'i1', nombre: 'Centro Puente Alto' }, escalada_por: { id: 's1', nombre: 'Andrés' },
    });
    expect(typeof aviso.datos.escalada_at).toBe('string');
  });

  test('refresca los contadores de Central y Administración, y sigue avisando a la instalación', async () => {
    await service.escalar('n1', supervisor);
    const refresco = emisiones.find((e) => e.evento === 'admin:dashboard_update');
    expect(refresco.sala).toEqual([salaAdmin('e1'), salaCentral('e1')]);
    expect(refresco.datos).toEqual({ entity: 'novedad' });
    expect(emisiones.find((e) => e.evento === 'novedad:escalada').sala).toBe(salaInstalacion('i1'));
  });

  test('un fallo de sockets no impide escalar', async () => {
    getSocketIO.mockImplementation(() => { throw new Error('sin sockets'); });
    await expect(service.escalar('n1', supervisor)).resolves.toMatchObject({ estado: ESTADO_NOVEDAD.ESCALADA });
  });
});

describe('derivar (asignar)', () => {
  beforeEach(() => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'c1', rol: ROLES.OPERADOR_CENTRAL, estado: ESTADO_USUARIO.ACTIVO });
  });

  test.each([ESTADO_NOVEDAD.ABIERTA, ESTADO_NOVEDAD.ESCALADA])('acepta una novedad %s y pasa a en atención', async (estado) => {
    prisma.novedad.findUnique.mockResolvedValue(novedad(estado));
    await expect(service.asignar('n1', 'c1', supervisor)).resolves.toMatchObject({ estado: ESTADO_NOVEDAD.EN_ATENCION, asignada_a: 'c1' });
  });

  test.each([ESTADO_NOVEDAD.RESUELTA, ESTADO_NOVEDAD.EN_ATENCION])('rechaza (409) una novedad %s', async (estado) => {
    prisma.novedad.findUnique.mockResolvedValue(novedad(estado));
    await expect(service.asignar('n1', 'c1', supervisor)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('responsables', () => {
  test('lista a Central y solo a los supervisores que cubren la instalación de la novedad', async () => {
    prisma.usuario.findMany.mockResolvedValue([
      { id: 'c1', nombre: 'Central', rol: ROLES.OPERADOR_CENTRAL },
      { id: 's1', nombre: 'Cubre', rol: ROLES.SUPERVISOR },
      { id: 's2', nombre: 'No cubre', rol: ROLES.SUPERVISOR },
    ]);
    resolverInstalacionesSupervisor.mockImplementation(async ({ id }) => (id === 's1' ? ['i1', 'i9'] : ['i7']));
    const lista = await service.responsables('n1', { id: 'c1', rol: ROLES.OPERADOR_CENTRAL });
    expect(lista).toEqual([
      { id: 'c1', nombre: 'Central', rol: ROLES.OPERADOR_CENTRAL },
      { id: 's1', nombre: 'Cubre', rol: ROLES.SUPERVISOR },
    ]);
  });

  test('un guardia no puede consultar la lista (403)', async () => {
    await expect(service.responsables('n1', { id: 'g1', rol: ROLES.GGSS_EN_PAUTA })).rejects.toMatchObject({ statusCode: 403 });
  });
});
