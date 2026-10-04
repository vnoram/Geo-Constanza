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
