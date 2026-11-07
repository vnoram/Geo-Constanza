const { conFolio } = require('../folioNovedad');

test('folio usa el año chileno y cinco dígitos', () => {
  expect(conFolio({ numero: 42, created_at: '2027-01-01T02:00:00Z' }).folio).toBe('NOV-2026-00042');
});

test('números distintos generan folios distintos y no se truncan', () => {
  const fecha = '2026-10-29T12:00:00Z';
  const folios = [1, 2, 99999, 100000].map(numero => conFolio({ numero, created_at: fecha }).folio);
  expect(new Set(folios).size).toBe(4);
  expect(folios[3]).toBe('NOV-2026-100000');
});
