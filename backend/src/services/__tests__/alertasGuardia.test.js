jest.mock('../../config/database', () => ({ prisma: {
  turno: { findMany: jest.fn() }, novedad: { findMany: jest.fn() }, solicitud: { findMany: jest.fn() }, asistencia: { findMany: jest.fn() },
} }));
const { prisma } = require('../../config/database');
const { construirAlertas, listarMias } = require('../alertasGuardia.service');
const { aFechaDB, instanteChile } = require('../../utils/fechaChile');

const ahora = instanteChile('2026-11-22', '20:00');
const turno = (id, fecha, ini, fin) => ({ id, fecha: aFechaDB(fecha), hora_inicio: ini, hora_fin: fin, instalacion: { nombre: 'Plaza Sur' } });

test('avisa el próximo turno dentro de 36 h y lo deja primero', () => {
  const r = construirAlertas({
    ahora, turnos: [turno('t2', '2026-11-23', '07:00', '19:00'), turno('t9', '2026-11-30', '07:00', '19:00')],
    solicitudes: [{ id: 's1', tipo: 'turno_extra', estado: 'aprobada', comentario_revision: 'Ok', revisor: { nombre: 'Marcela' }, updated_at: new Date('2026-11-22T22:00:00Z') }],
  });
  expect(r.map((a) => a.id)).toEqual(['turno-t2', 'solicitud-s1']);
  expect(r[0]).toMatchObject({ nivel: 'warning', titulo: 'Próximo turno: 07:00 — 19:00', detalle: 'Plaza Sur' });
});

test('un turno que ya terminó o está lejos no genera aviso; el que está en curso se informa como tal', () => {
  expect(construirAlertas({ ahora, turnos: [turno('t0', '2026-11-22', '07:00', '19:00'), turno('t9', '2026-11-30', '07:00', '19:00')] })).toEqual([]);
  const enCurso = construirAlertas({ ahora, turnos: [turno('t1', '2026-11-22', '19:00', '07:00')] });
  expect(enCurso[0]).toMatchObject({ nivel: 'info', titulo: 'Turno en curso: 19:00 — 07:00' });
});

test('novedades, solicitudes y marcajes pendientes no generan alerta; los resueltos sí, con su nivel', () => {
  const f = new Date('2026-11-22T15:00:00Z');
  const r = construirAlertas({
    ahora,
    novedades: [
      { id: 'n1', numero: 7, tipo: 'Robo', estado: 'escalada', responsable: { nombre: 'Patricio' }, fecha_atencion: f, created_at: f },
      { id: 'n2', numero: 8, tipo: 'Ronda', estado: 'abierta', created_at: f },
    ],
    solicitudes: [{ id: 's1', tipo: 'vacaciones', estado: 'pendiente', updated_at: f }],
    marcajes: [
      { id: 'a1', revision_estado: 'rechazado', comentario_revision: 'Fuera', revisado_en: f, hora_entrada: f },
      { id: 'a2', revision_estado: null, hora_entrada: f },
    ],
  });
  expect(r.map((a) => [a.id, a.nivel])).toEqual([['novedad-n1', 'warning'], ['marcaje-a1', 'error']]);
});

test('la consulta siempre va acotada a la empresa y al usuario del token', async () => {
  prisma.turno.findMany.mockResolvedValue([]); prisma.novedad.findMany.mockResolvedValue([]);
  prisma.solicitud.findMany.mockResolvedValue([]); prisma.asistencia.findMany.mockResolvedValue([]);
  expect(await listarMias({ id: 'g1', empresaId: 'e1' }, ahora)).toEqual([]);
  for (const modelo of ['turno', 'novedad', 'solicitud', 'asistencia']) {
    expect(prisma[modelo].findMany.mock.calls[0][0].where).toMatchObject({ empresa_id: 'e1', usuario_id: 'g1' });
  }
});
