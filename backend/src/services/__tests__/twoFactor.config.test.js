jest.mock('../../config/database', () => ({ prisma: {} }));
jest.mock('../../config/redis', () => ({ getRedis: () => null }));
jest.mock('../../config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; jest.resetModules(); });

const cargar = (env) => {
  process.env = { ...original, ...env };
  jest.resetModules();
  jest.doMock('../../config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));
  return { servicio: require('../twoFactor.service'), logger: require('../../config/logger').logger };
};

test('en producción sin clave de cifrado el 2FA se desactiva y se avisa una sola vez', () => {
  const { servicio, logger } = cargar({ NODE_ENV: 'production', REQUIRE_2FA: '', TWO_FACTOR_ENCRYPTION_KEY: '' });
  expect(servicio.dosFactoresExigido()).toBe(false);
  expect(servicio.dosFactoresExigido()).toBe(false);
  expect(logger.error).toHaveBeenCalledTimes(1);
});

test('REQUIRE_2FA=true sin clave tampoco bloquea el acceso', () => {
  const { servicio } = cargar({ NODE_ENV: 'production', REQUIRE_2FA: 'true', TWO_FACTOR_ENCRYPTION_KEY: '   ' });
  expect(servicio.dosFactoresExigido()).toBe(false);
});

test('con clave configurada se exige en producción y se respeta REQUIRE_2FA=false', () => {
  expect(cargar({ NODE_ENV: 'production', REQUIRE_2FA: '', TWO_FACTOR_ENCRYPTION_KEY: 'clave-larga-de-prueba-123456' }).servicio.dosFactoresExigido()).toBe(true);
  expect(cargar({ NODE_ENV: 'production', REQUIRE_2FA: 'false', TWO_FACTOR_ENCRYPTION_KEY: 'clave-larga-de-prueba-123456' }).servicio.dosFactoresExigido()).toBe(false);
  expect(cargar({ NODE_ENV: 'development', REQUIRE_2FA: '', TWO_FACTOR_ENCRYPTION_KEY: '' }).servicio.dosFactoresExigido()).toBe(false);
});
