// Regresión del manejo de zona horaria en asistencia (hora de Chile con servidor en UTC).

const mockPrisma = {
  turno: { findMany: jest.fn() },
  asistencia: {
    findFirst: jest.fn(),
    create: jest.fn(async ({ data }) => ({ id: 'a1', ...data })),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(async ({ data }) => data),
  },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));
jest.mock('../src/socket/socketManager', () => ({ getSocketIO: () => { throw new Error('sin socket'); } }));
jest.mock('../src/services/geovalidacion.service', () => ({}));
jest.mock('../src/services/notificacion.service', () => ({}));

const { registrarEntradaTablet, registrarSalida, seleccionarTurno } = require('../src/services/asistencia.service');

const INST = { id: 'i1', nombre: 'Edificio', latitud: 0, longitud: 0, radio_geofence_m: 100 };
const turno = (id, dia, ini, fin) => ({
  id, fecha: new Date(`${dia}T00:00:00Z`), hora_inicio: ini, hora_fin: fin, instalacion: INST,
});
const usuario = { id: 'g1', rol: 'pauta' };

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.asistencia.findFirst.mockResolvedValue(null);
});
afterEach(() => jest.useRealTimers());

const enHora = (iso) => jest.useFakeTimers().setSystemTime(new Date(iso));

describe('A. retraso calculado en hora de Chile', () => {
  test('marcar puntual (08:00 de Chile) no genera retraso', async () => {
    enHora('2026-10-20T11:00:00Z'); // 08:00 en Chile (UTC-3)
    mockPrisma.turno.findMany.mockResolvedValue([turno('t1', '2026-10-20', '08:00', '16:00')]);
    const r = await registrarEntradaTablet({ instalacion_id: 'i1' }, usuario);
    expect(r.minutos_retraso).toBe(0);
    expect(r.estado).toBe('normal');
  });

  test('en invierno (UTC-4) también es puntual', async () => {
    enHora('2026-07-15T12:00:00Z'); // 08:00 en Chile
    mockPrisma.turno.findMany.mockResolvedValue([turno('t1', '2026-07-15', '08:00', '16:00')]);
    const r = await registrarEntradaTablet({ instalacion_id: 'i1' }, usuario);
    expect(r.minutos_retraso).toBe(0);
  });

  test('25 minutos tarde queda como tardío con 25 min', async () => {
    enHora('2026-10-20T11:25:00Z');
    mockPrisma.turno.findMany.mockResolvedValue([turno('t1', '2026-10-20', '08:00', '16:00')]);
    const r = await registrarEntradaTablet({ instalacion_id: 'i1' }, usuario);
    expect(r.minutos_retraso).toBe(25);
    expect(r.estado).toBe('tardio');
  });

  test('llegar 10 minutos antes no genera retraso', async () => {
    enHora('2026-10-20T10:50:00Z');
    mockPrisma.turno.findMany.mockResolvedValue([turno('t1', '2026-10-20', '08:00', '16:00')]);
    const r = await registrarEntradaTablet({ instalacion_id: 'i1' }, usuario);
    expect(r.minutos_retraso).toBe(0);
  });
});

describe('B. horas extra calculadas en hora de Chile', () => {
  const salir = async (t, entradaISO, salidaISO) => {
    mockPrisma.asistencia.findUniqueOrThrow.mockResolvedValue({
      id: 'a1', hora_entrada: new Date(entradaISO), turno: t,
    });
    enHora(salidaISO);
    await registrarSalida({ asistencia_id: 'a1', metodo: 'tablet' }, usuario);
    return mockPrisma.asistencia.update.mock.calls[0][0].data;
  };

  test('salir puntual de un turno diurno no genera horas extra', async () => {
    const d = await salir(turno('t1', '2026-10-20', '08:00', '16:00'), '2026-10-20T11:00:00Z', '2026-10-20T19:00:00Z');
    expect(d.horas_extra).toBe(0);
    expect(d.horas_trabajadas).toBe(8);
  });

  test('salir puntual de un turno nocturno no genera horas extra', async () => {
    const d = await salir(turno('t2', '2026-10-20', '19:00', '07:00'), '2026-10-20T22:00:00Z', '2026-10-21T10:00:00Z');
    expect(d.horas_extra).toBe(0);
    expect(d.horas_trabajadas).toBe(12);
  });

  test('salir 90 minutos después del fin cuenta 1,5 horas extra', async () => {
    const d = await salir(turno('t2', '2026-10-20', '19:00', '07:00'), '2026-10-20T22:00:00Z', '2026-10-21T11:30:00Z');
    expect(d.horas_extra).toBe(1.5);
  });
});

describe('C. selección del turno vigente', () => {
  const hoy = turno('hoy', '2026-10-20', '19:00', '07:00');
  const manana = turno('manana', '2026-10-21', '19:00', '07:00');

  test('de noche elige el turno de hoy aunque ya sea "mañana" en UTC', () => {
    // 21:30 en Chile = 00:30Z del día siguiente
    expect(seleccionarTurno([hoy, manana], new Date('2026-10-21T00:30:00Z')).id).toBe('hoy');
  });

  test('en la madrugada sigue vigente el turno nocturno de ayer', () => {
    // 03:00 en Chile del 21
    expect(seleccionarTurno([hoy, manana], new Date('2026-10-21T06:00:00Z')).id).toBe('hoy');
  });

  test('permite marcar hasta 15 minutos antes del inicio, no antes', () => {
    expect(seleccionarTurno([hoy], new Date('2026-10-20T21:46:00Z'))).not.toBeNull(); // 18:46
    expect(seleccionarTurno([hoy], new Date('2026-10-20T21:44:00Z'))).toBeNull();     // 18:44
  });

  test('no hay turno vigente una vez terminado', () => {
    expect(seleccionarTurno([hoy], new Date('2026-10-21T10:01:00Z'))).toBeNull();
  });

  test('con turnos seguidos gana el que empezó más recientemente', () => {
    const a = turno('a', '2026-10-20', '08:00', '16:00');
    const b = turno('b', '2026-10-20', '15:50', '23:00');
    expect(seleccionarTurno([a, b], new Date('2026-10-20T19:00:00Z')).id).toBe('b'); // 16:00 en Chile
  });

  test('registrarEntrada rechaza si no hay turno vigente', async () => {
    enHora('2026-10-20T20:00:00Z'); // 17:00, ya terminó el de 08-16
    mockPrisma.turno.findMany.mockResolvedValue([turno('t1', '2026-10-20', '08:00', '16:00')]);
    await expect(registrarEntradaTablet({ instalacion_id: 'i1' }, usuario)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.asistencia.create).not.toHaveBeenCalled();
  });
});
