const { validarAsistencia } = require('../geovalidacion.service');

test('informa distancia, radio y precisión en un rechazo fuera de rango', () => {
  const resultado = validarAsistencia(0, 0.0122, 0, 0, 100, 250);

  expect(resultado.esValido).toBe(false);
  expect(resultado.mensaje).toBe(
    'Estás a 1357 m de la instalación (máximo permitido: 100 m). '
    + 'La precisión de tu ubicación es de ±250 m. '
    + 'Tu ubicación es imprecisa; usa un dispositivo con GPS.',
  );
});

test('una lectura imprecisa fuera del radio sigue siendo rechazada', () => {
  const resultado = validarAsistencia(0, 0.001, 0, 0, 100, 5000);

  expect(resultado.distanciaMetros).toBe(111);
  expect(resultado.esValido).toBe(false);
});

test('la precisión informada no altera una lectura dentro del radio', () => {
  const resultado = validarAsistencia(0, 0.0005, 0, 0, 100, 5000);

  expect(resultado.distanciaMetros).toBe(56);
  expect(resultado.esValido).toBe(true);
});

test('un cliente antiguo sin precisión conserva un mensaje sin precisión inventada', () => {
  const resultado = validarAsistencia(0, 0.001, 0, 0, 100);

  expect(resultado.esValido).toBe(false);
  expect(resultado.mensaje).not.toContain('precisión');
});

describe('clasificarMarcaje', () => {
  const { clasificarMarcaje, PRECISION_MAX_UTIL_M } = require('../geovalidacion.service');
  // 0.0005° de longitud en el ecuador ≈ 56 m; 0.002° ≈ 222 m
  const clasificar = (lonGuardia, radio, precision) => clasificarMarcaje(0, lonGuardia, 0, 0, radio, precision);

  test('dentro del radio y con buena precisión queda verificado', () => {
    const r = clasificar(0.0005, 100, 15);
    expect(r.resultado).toBe('verificado');
    expect(r.permitido).toBe(true);
    expect(r.distanciaMetros).toBe(56);
  });

  test('un cliente antiguo sin precisión, dentro del radio, queda verificado', () => {
    expect(clasificar(0.0005, 100).resultado).toBe('verificado');
  });

  test('dentro del radio pero con precisión peor que el radio queda por revisar', () => {
    const r = clasificar(0.0005, 100, 400);
    expect(r.resultado).toBe('por_revisar');
    expect(r.permitido).toBe(true);
  });

  test('un PC que ubica a 222 m con error de ±300 m puede estar dentro: por revisar, no rechazado', () => {
    const r = clasificar(0.002, 100, 300);
    expect(r.resultado).toBe('por_revisar');
    expect(r.permitido).toBe(true);
  });

  test('claramente fuera aun descontando el error se rechaza', () => {
    const r = clasificar(0.01, 100, 50); // ≈ 1112 m, error de 50 m
    expect(r.resultado).toBe('fuera');
    expect(r.permitido).toBe(false);
    expect(r.mensaje).toContain('1112 m');
  });

  test('sin precisión y fuera del radio se rechaza', () => {
    expect(clasificar(0.002, 100).permitido).toBe(false);
  });

  test('un error mayor al máximo útil deja el marcaje sin ubicación, aceptado y señalado', () => {
    const r = clasificar(0.05, 100, PRECISION_MAX_UTIL_M + 1);
    expect(r.resultado).toBe('sin_ubicacion');
    expect(r.permitido).toBe(true);
    expect(r.mensaje).toMatch(/celular/i);
  });

  test('sin coordenadas el marcaje queda sin ubicación, no verificado', () => {
    const r = clasificarMarcaje(null, null, 0, 0, 100, null);
    expect(r.resultado).toBe('sin_ubicacion');
    expect(r.permitido).toBe(true);
    expect(r.distanciaMetros).toBeNull();
  });

  test('coordenadas basura no se tratan como una ubicación válida', () => {
    expect(clasificarMarcaje('abc', NaN, 0, 0, 100, 10).resultado).toBe('sin_ubicacion');
  });
});
