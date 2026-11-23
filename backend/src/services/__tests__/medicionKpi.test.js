const { percentil, resumir } = require('../../../scripts/medicion-kpi');

test('percentil por rango más cercano', () => {
  const v = Array.from({ length: 100 }, (_, i) => i + 1);
  expect([percentil(v, 50), percentil(v, 95), percentil(v, 99), percentil(v, 100)]).toEqual([50, 95, 99, 100]);
  expect(percentil([7], 99)).toBe(7);
  expect(percentil([], 50)).toBeNull();
});

test('el veredicto exige p95 bajo el umbral y cero errores, y avisa de muestras pequeñas', () => {
  const ok = resumir('x', Array.from({ length: 30 }, () => 800), [], 3000);
  expect(ok).toMatchObject({ cumple: true, muestra_pequena: false, bajo_umbral_pct: 100 });
  expect(resumir('x', [800, 900], [], 3000)).toMatchObject({ cumple: true, muestra_pequena: true });
  expect(resumir('x', [800, 3500], [], 3000).cumple).toBe(false);
  expect(resumir('x', [800], ['falló'], 3000).cumple).toBe(false);
  expect(resumir('x', [], ['falló'], 3000).cumple).toBe(false);
});
