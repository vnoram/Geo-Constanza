// Libro de rondas: los tipos de rutina (Ronda, Sin novedad, Fin de ronda, Cambio de turno) se separan de las incidencias.
jest.mock('../../config/database', () => ({ prisma: {
  novedad: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
  turno: { findMany: jest.fn() },
  instalacion: { findMany: jest.fn(), count: jest.fn() },
  usuario: { count: jest.fn() },
  asistencia: { findMany: jest.fn(), groupBy: jest.fn() },
  supervisor_Instalacion: { findMany: jest.fn() },
} }));

const fs = require('fs');
const path = require('path');
const { prisma } = require('../../config/database');
const { TIPOS_RUTINA, SOLO_INCIDENCIAS, evaluarUrgencia } = require('../priorizacion.service');
const reportes = require('../reportes.service');
const { getDashboardHoy } = require('../dashboard.service');
const { ROLES } = require('../../constants/roles');

const admin = { id: 'a1', rol: ROLES.ADMINISTRADOR };

beforeEach(() => {
  jest.resetAllMocks();
  prisma.novedad.findMany.mockResolvedValue([]);
  prisma.novedad.count.mockResolvedValue(0);
  prisma.novedad.groupBy.mockResolvedValue([]);
  prisma.turno.findMany.mockResolvedValue([]);
  prisma.instalacion.findMany.mockResolvedValue([]);
  prisma.instalacion.count.mockResolvedValue(0);
  prisma.usuario.count.mockResolvedValue(0);
  prisma.asistencia.findMany.mockResolvedValue([]);
  prisma.asistencia.groupBy.mockResolvedValue([]);
});

describe('tipos de rutina', () => {
  test('son exactamente los cuatro tipos de urgencia verde', () => {
    expect([...TIPOS_RUTINA].sort()).toEqual(['Cambio de turno', 'Fin de ronda', 'Ronda', 'Sin novedad']);
    for (const t of TIPOS_RUTINA) expect(evaluarUrgencia(t)).toBe('verde');
  });

  test('SOLO_INCIDENCIAS deja fuera la rutina', () => {
    expect(SOLO_INCIDENCIAS).toEqual({ tipo: { notIn: TIPOS_RUTINA } });
  });

  test('el frontend usa la misma lista (si cambia una, cambia la otra)', () => {
    const texto = fs.readFileSync(path.join(__dirname, '../../../../frontend/src/utils/novedades.js'), 'utf8');
    const lista = /TIPOS_RUTINA\s*=\s*\[([^\]]*)\]/.exec(texto)[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
    expect([...lista].sort()).toEqual([...TIPOS_RUTINA].sort());
  });
});

describe('reporte de incidentes con ?categoria=', () => {
  const tipoFiltro = () => prisma.novedad.findMany.mock.calls[0][0].where.tipo;

  test('incidencias excluye la rutina', async () => {
    await reportes.reporteIncidentes({ categoria: 'incidencias' }, admin);
    expect(tipoFiltro()).toEqual({ notIn: TIPOS_RUTINA });
  });

  test('rutina trae solo el libro de rondas', async () => {
    await reportes.reporteIncidentes({ categoria: 'rutina' }, admin);
    expect(tipoFiltro()).toEqual({ in: TIPOS_RUTINA });
  });

  test('sin categoria devuelve todo, como antes', async () => {
    await reportes.reporteIncidentes({}, admin);
    expect(tipoFiltro()).toBeUndefined();
  });

  test('un tipo explícito manda sobre la categoría', async () => {
    await reportes.reporteIncidentes({ tipo: 'Robo', categoria: 'rutina' }, admin);
    expect(tipoFiltro()).toBe('Robo');
  });

  test('un valor de categoría desconocido no filtra', async () => {
    await reportes.reporteIncidentes({ categoria: 'otra' }, admin);
    expect(tipoFiltro()).toBeUndefined();
  });
});

describe('los contadores no cuentan la rutina', () => {
  test('el resumen semanal de novedades excluye la rutina', async () => {
    await reportes.novedadesPorSemana(admin);
    expect(prisma.novedad.findMany.mock.calls[0][0].where.tipo).toEqual({ notIn: TIPOS_RUTINA });
  });

  test('el panel central informa las pendientes por urgencia (sin rutina) y los guardias en pauta', async () => {
    prisma.novedad.groupBy.mockResolvedValue([{ urgencia: 'rojo', _count: { _all: 2 } }, { urgencia: 'verde', _count: { _all: 5 } }]);
    prisma.usuario.count.mockResolvedValue(9);
    const panel = await getDashboardHoy({ id: 'c1', rol: ROLES.OPERADOR_CENTRAL });
    expect(panel.kpis.pendientesPorUrgencia).toEqual({ rojo: 2, verde: 5 });
    expect(panel.kpis.guardiasEnPauta).toBe(9);
    const donde = prisma.novedad.groupBy.mock.calls[0][0].where;
    expect(donde.tipo).toEqual({ notIn: TIPOS_RUTINA });
    expect(donde.estado).toEqual({ not: 'resuelta' });
  });

  test('el panel central cuenta solo incidencias abiertas y escaladas', async () => {
    await getDashboardHoy({ id: 'c1', rol: ROLES.OPERADOR_CENTRAL });
    const conteos = prisma.novedad.count.mock.calls.map((c) => c[0].where);
    expect(conteos.length).toBeGreaterThanOrEqual(2);
    for (const w of conteos) expect(w.tipo).toEqual({ notIn: TIPOS_RUTINA });
  });
});
