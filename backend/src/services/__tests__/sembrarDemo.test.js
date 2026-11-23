const { fechasDeTrabajo, esBaseLocal, DIAS_PAUTA } = require('../../../prisma/sembrar-demo-empresa');

test('la siembra proyecta 6 meses con 4 días de trabajo y 4 de descanso', () => {
  const f = fechasDeTrabajo('2026-11-16', 0);
  expect(f).toHaveLength(92);
  expect(DIAS_PAUTA).toBe(184);
  expect(f.slice(0, 5)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-24']);
});

test('las dos cuadrillas desfasadas cubren todos los días sin solaparse', () => {
  const a = new Set(fechasDeTrabajo('2026-11-16', 0));
  const b = new Set(fechasDeTrabajo('2026-11-16', 4));
  for (let i = 0; i < DIAS_PAUTA; i += 1) {
    const d = new Date(Date.UTC(2026, 10, 16 + i)).toISOString().slice(0, 10);
    expect(Number(a.has(d)) + Number(b.has(d))).toBe(1);
  }
});

test('se niega a sembrar bases que no son locales', () => {
  expect(esBaseLocal('postgresql://u:p@db:5432/geo_local')).toBe(true);
  expect(esBaseLocal('postgresql://u:p@localhost:5432/x')).toBe(true);
  expect(esBaseLocal('postgresql://u:p@pg-geo-constanza.postgres.database.azure.com:5432/x')).toBe(false);
  expect(esBaseLocal('no-es-una-url')).toBe(false);
});
