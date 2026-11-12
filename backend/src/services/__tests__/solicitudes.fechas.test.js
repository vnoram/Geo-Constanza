jest.mock('../../config/database', () => ({ prisma: {} }));
jest.mock('../notificacion.service', () => ({ enviarNotificacion: jest.fn() }));
jest.mock('../supervisor.helper', () => ({ exigirAlcanceInstalacion: jest.fn() }));
jest.mock('../../utils/azureStorage', () => ({ uploadAdjuntoToAzure: jest.fn(), generarUrlLectura: jest.fn() }));

const { normalizarFechas, agruparConsecutivas } = require('../solicitudes.service');

describe('fechas de solicitudes', () => {
  test('ordena, quita repetidas y acepta JSON de multipart', () => {
    expect(normalizarFechas('["2026-12-03","2026-12-01","2026-12-03"]')).toEqual(['2026-12-01', '2026-12-03']);
    expect(normalizarFechas(undefined)).toBeNull();
  });

  test.each([[[]], ['no-json'], [['2026-13-40']], [['hoy']], [Array.from({ length: 32 }, (_, i) => `2026-12-${String((i % 28) + 1).padStart(2, '0')}x`)]])(
    'rechaza %j', (valor) => { expect(() => normalizarFechas(valor)).toThrow(/fechas válidas/); },
  );

  test('une los días consecutivos en un tramo y separa los saltos', () => {
    expect(agruparConsecutivas(['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-10', '2026-12-31', '2027-01-01']))
      .toEqual([['2026-12-01', '2026-12-03'], ['2026-12-10', '2026-12-10'], ['2026-12-31', '2027-01-01']]);
  });
});
