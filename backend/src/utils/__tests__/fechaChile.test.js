const { ahoraChile, instanteChile, intervaloTurno, seSolapan, turnoVigente, turnosDeHoy } = require('../fechaChile');

const turno = (fecha, hora_inicio, hora_fin) => ({ fecha, hora_inicio, hora_fin });

test.each([
  ['2026-07-15', '12:00', '2026-07-15T16:00:00.000Z'],
  ['2026-10-15', '12:00', '2026-10-15T15:00:00.000Z'],
  ['2026-04-04', '23:30', '2026-04-05T02:30:00.000Z'], // hora repetida: primera
  ['2026-04-05', '00:00', '2026-04-05T04:00:00.000Z'],
  ['2026-09-05', '23:59', '2026-09-06T03:59:00.000Z'],
  ['2026-09-06', '00:30', '2026-09-06T04:30:00.000Z'], // salto: 01:30
  ['2026-09-06', '01:00', '2026-09-06T04:00:00.000Z'],
])('convierte %s %s sin depender de TZ', (fecha, hora, esperado) => {
  expect(instanteChile(fecha, hora).toISOString()).toBe(esperado);
});

test.each([
  [turno('2026-09-26', '20:00', '08:00'), turno('2026-09-27', '00:00', '14:00'), true],
  [turno('2026-09-27', '06:00', '14:00'), turno('2026-09-27', '14:00', '22:00'), false],
  [turno('2026-09-26', '20:00', '08:00'), turno('2026-09-27', '20:00', '08:00'), false],
])('compara intervalos reales y permite contiguos', (a, b, esperado) => {
  expect(seSolapan(intervaloTurno(a), intervaloTurno(b))).toBe(esperado);
  expect(seSolapan(intervaloTurno(b), intervaloTurno(a))).toBe(esperado);
});

test.each([
  ['2026-04-04', 13], ['2026-09-05', 11],
])('duración real al cambiar hora: %s', (fecha, horas) => {
  const { inicio, fin } = intervaloTurno(turno(fecha, '20:00', '08:00'));
  expect((fin - inicio) / 3600000).toBe(horas);
});

test('tolerancia inclusiva y fin exclusivo', () => {
  const t = turno('2026-09-27', '00:00', '14:00');
  expect(turnoVigente(t, instanteChile('2026-09-26', '23:45'), 15)).toBe(true);
  expect(turnoVigente(t, instanteChile('2026-09-26', '23:44'), 15)).toBe(false);
  expect(turnoVigente(t, instanteChile('2026-09-27', '14:00'), 15)).toBe(false);
});

test('dashboard incluye nocturno de ayer hasta su fin real', () => {
  const t = turno('2026-09-26', '20:00', '08:00');
  expect(turnosDeHoy(instanteChile('2026-09-27', '00:21')).incluir(t)).toBe(true);
  expect(turnosDeHoy(instanteChile('2026-09-27', '08:00')).incluir(t)).toBe(false);
});

describe('turno nocturno del 3 de octubre en hora Chile', () => {
  const nocturno = turno('2026-10-03', '19:00', '07:00');
  const diaSiguiente = turno('2026-10-04', '19:00', '07:00');

  test('a las 22:00 del 3 de octubre sigue siendo día 3 en Chile', () => {
    const ahora = new Date('2026-10-04T01:00:00.000Z');
    expect(ahoraChile(ahora)).toEqual({ fecha: '2026-10-03', hora: '22:00' });
    expect(turnoVigente(nocturno, ahora, 15)).toBe(true);
    expect(turnoVigente(diaSiguiente, ahora, 15)).toBe(false);
  });

  test.each([
    ['2026-10-03', '18:45', true],
    ['2026-10-03', '18:44', false],
    ['2026-10-04', '06:59', true],
    ['2026-10-04', '07:00', false],
  ])('%s %s respeta tolerancia y fin exclusivo', (fecha, hora, esperado) => {
    expect(turnoVigente(nocturno, instanteChile(fecha, hora), 15)).toBe(esperado);
  });
});
