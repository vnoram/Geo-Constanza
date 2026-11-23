const { crearAleatorio, fechasPasadas, generarMarcaje, generarNovedades, estadoNovedad, offsetSantiago, instanteLocal } = require('../../../prisma/sembrar-demo-actividad');

test('el generador es determinista para una misma semilla', () => {
  const a = crearAleatorio(7); const b = crearAleatorio(7);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

test('las fechas pasadas siguen el ciclo 4x4 y nunca incluyen hoy', () => {
  const f = fechasPasadas('2026-11-23', 0, 30);
  expect(f.every((d) => d < '2026-11-23')).toBe(true);
  expect(f).toHaveLength(15);
  // Coherente con la pauta sembrada: el día 0 es hoy - 7 (16 nov) y trabaja del 16 al 19.
  expect(f).toEqual(expect.arrayContaining(['2026-11-16', '2026-11-19']));
  expect(f).not.toContain('2026-11-20');
});

test('las dos cuadrillas desfasadas no coinciden en ningún día', () => {
  const a = new Set(fechasPasadas('2026-11-23', 0)); const b = fechasPasadas('2026-11-23', 4);
  expect(b.some((d) => a.has(d))).toBe(false);
});

test('los marcajes respetan sus invariantes', () => {
  const r = crearAleatorio(1);
  const vistos = new Set();
  for (let i = 0; i < 500; i += 1) {
    const m = generarMarcaje(r, 'irregular');
    vistos.add(m.tipo);
    if (m.tipo === 'ausente') continue;
    expect(m.horasTrabajadas).toBeGreaterThan(9);
    if (m.tipo === 'tardio') expect(m.retraso).toBeGreaterThanOrEqual(6);
    else expect(m.retraso).toBe(0);
    if (m.tipo === 'por_revisar') expect(m.distancia).toBeGreaterThan(200);
  }
  expect([...vistos].sort()).toEqual(['ausente', 'normal', 'por_revisar', 'tardio']);
});

test('las novedades usan tipos con urgencia coherente y variada', () => {
  const r = crearAleatorio(3);
  const todas = Array.from({ length: 400 }, () => generarNovedades(r, 1)).flat();
  expect(todas.length).toBeGreaterThan(400);
  expect(new Set(todas.map((n) => n.urgencia))).toEqual(new Set(['verde', 'amarillo', 'rojo']));
  expect(todas.every((n) => n.descripcion.length > 10)).toBe(true);
});

test('las novedades verdes siempre quedan resueltas y las antiguas casi nunca abiertas', () => {
  const r = crearAleatorio(5);
  for (let i = 0; i < 50; i += 1) expect(estadoNovedad(r, 'verde', 0)).toBe('resuelta');
  for (let i = 0; i < 100; i += 1) expect(estadoNovedad(r, 'amarillo', 20)).not.toBe('abierta');
});

test('la hora local de Santiago se convierte a UTC con el offset de la fecha', () => {
  expect(offsetSantiago('2026-11-20')).toBe(3);
  expect(offsetSantiago('2026-07-01')).toBe(4);
  expect(instanteLocal('2026-11-20', '07:00').toISOString()).toBe('2026-11-20T10:00:00.000Z');
});
