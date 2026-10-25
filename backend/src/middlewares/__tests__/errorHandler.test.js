jest.mock('../../config/logger', () => ({ logger: { error: jest.fn() } }));

const { errorHandler } = require('../errorHandler');

const responder = (err) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  errorHandler(err, { path: '/x', method: 'POST' }, res, () => {});
  return { codigo: res.status.mock.calls[0][0], cuerpo: res.json.mock.calls[0][0] };
};

describe('errorHandler', () => {
  const entorno = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = entorno; });

  test('un error interno nunca devuelve el mensaje con rutas ni código', () => {
    process.env.NODE_ENV = 'production';
    const { codigo, cuerpo } = responder(new Error('Invalid `prisma.usuario.findUnique()` invocation in C:\\Users\\x\\auth.service.js:12'));
    expect(codigo).toBe(500);
    expect(cuerpo.error).toBe('Error interno del servidor');
    expect(JSON.stringify(cuerpo)).not.toMatch(/prisma|C:\\|auth\.service/);
  });

  test('en desarrollo el motivo viaja aparte y no en "error"', () => {
    process.env.NODE_ENV = 'development';
    const { cuerpo } = responder(new Error('detalle técnico'));
    expect(cuerpo.error).toBe('Error interno del servidor');
    expect(cuerpo.detalle).toBe('detalle técnico');
  });

  test('base de datos inaccesible responde 503 con un mensaje claro', () => {
    process.env.NODE_ENV = 'production';
    const { codigo, cuerpo } = responder(new Error("Invalid invocation ... Can't reach database server at 127.0.0.1:5433"));
    expect(codigo).toBe(503);
    expect(cuerpo.error).toMatch(/no está disponible/i);
    expect(cuerpo.detalle).toBeUndefined();
  });

  test('"Server has closed the connection" también es 503', () => {
    const { codigo } = responder(new Error('Server has closed the connection.'));
    expect(codigo).toBe(503);
  });

  test('un error de negocio con código 4xx conserva su mensaje', () => {
    const err = Object.assign(new Error('No tienes un turno vigente.'), { statusCode: 400 });
    const { codigo, cuerpo } = responder(err);
    expect(codigo).toBe(400);
    expect(cuerpo.error).toBe('No tienes un turno vigente.');
  });
});
