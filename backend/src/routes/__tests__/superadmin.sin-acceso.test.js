// El super admin es de nivel de plataforma: NO puede ver ni operar datos de guardias, turnos ni novedades.
// Se prueba contra los routers reales, con la base simulada (si alguna ruta llegara a consultarla, la prueba lo delata).
jest.mock('../../middlewares/auth', () => ({
  authenticate: (req, _res, next) => { req.user = JSON.parse(req.get('x-test-user')); next(); },
}));
jest.mock('../../config/database', () => {
  const consulta = () => { throw new Error('el super admin llegó a una consulta de datos de empresa'); };
  const modelo = new Proxy({}, { get: () => consulta });
  const prisma = new Proxy({}, { get: () => modelo });
  return { prisma, prismaGlobal: { usuario: { findUniqueOrThrow: jest.fn() } } };
});
jest.mock('../../config/redis', () => ({ getRedis: jest.fn(() => null) }));
jest.mock('../../utils/azureStorage', () => ({ generarUrlLectura: jest.fn(), uploadFotoToAzure: jest.fn() }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn(), desconectarEmpresa: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { prismaGlobal } = require('../../config/database');
const { ROLES } = require('../../constants/roles');
const { errorHandler } = require('../../middlewares/errorHandler');

const app = express();
app.use(express.json());
const montar = (prefijo, ruta) => app.use(prefijo, require(ruta));
montar('/usuarios', '../usuarios.routes');
montar('/instalaciones', '../instalaciones.routes');
montar('/turnos', '../turnos.routes');
montar('/asistencia', '../asistencia.routes');
montar('/novedades', '../novedades.routes');
montar('/solicitudes', '../solicitudes.routes');
montar('/dashboard', '../dashboard.routes');
montar('/reportes', '../reportes.routes');
montar('/auditoria', '../auditoria.routes');
app.use(errorHandler);

const como = (user) => ({ 'x-test-user': JSON.stringify(user) });
const superAdmin = { id: 'sa1', rol: ROLES.SUPER_ADMIN, empresaId: null };

const RUTAS_OPERATIVAS = [
  ['get', '/usuarios'], ['post', '/usuarios'], ['put', '/usuarios/u1'], ['patch', '/usuarios/u1/desactivar'],
  ['get', '/instalaciones'], ['post', '/instalaciones'], ['put', '/instalaciones/i1'],
  ['get', '/turnos'], ['get', '/turnos/t1'], ['post', '/turnos'], ['put', '/turnos/t1'], ['patch', '/turnos/t1/cancelar'], ['post', '/turnos/lote'],
  ['get', '/asistencia/estado-actual'], ['post', '/asistencia/entrada'], ['post', '/asistencia/salida'], ['get', '/asistencia/hoy/i1'], ['get', '/asistencia/historial/u1'],
  ['get', '/novedades'], ['get', '/novedades/n1'], ['post', '/novedades'], ['patch', '/novedades/n1/resolver'], ['patch', '/novedades/n1/escalar'],
  ['get', '/solicitudes'], ['post', '/solicitudes'], ['patch', '/solicitudes/s1/aprobar'],
  ['get', '/dashboard/hoy'], ['get', '/reportes/asistencia'], ['get', '/reportes/incidentes'], ['get', '/auditoria'],
];

describe('el super admin no accede a rutas operativas', () => {
  test.each(RUTAS_OPERATIVAS)('%s %s responde 403', async (metodo, ruta) => {
    const res = await request(app)[metodo](ruta).set(como(superAdmin)).send({});
    expect(res.status).toBe(403);
  });

  test('un usuario SIN empresa en el token (aunque tenga un rol operativo) tampoco entra', async () => {
    for (const rol of [ROLES.ADMINISTRADOR, ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL]) {
      const res = await request(app).get('/dashboard/hoy').set(como({ id: 'x', rol, empresaId: null }));
      expect(res.status).toBe(403);
    }
  });

  test('pero sí puede ver su propio perfil', async () => {
    prismaGlobal.usuario.findUniqueOrThrow.mockResolvedValue({ id: 'sa1', rol: 'super_admin', empresa: null });
    const res = await request(app).get('/usuarios/me').set(como(superAdmin));
    expect(res.status).toBe(200);
    expect(res.body.rol).toBe('super_admin');
  });

  test('registrar el token del dispositivo (push) es operativo y está cerrado al nivel de plataforma', async () => {
    expect((await request(app).put('/usuarios/me/token-dispositivo').set(como(superAdmin)).send({ token: 'x' })).status).toBe(403);
  });
});
