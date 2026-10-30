jest.mock('../../config/database', () => ({ prisma: {
  novedad: { findUnique: jest.fn() }, solicitud: { findUnique: jest.fn() },
} }));
jest.mock('../../middlewares/auditLog', () => ({ registrarAuditoria: jest.fn() }));
jest.mock('../../services/novedades.service', () => ({ asignar: jest.fn(), resolver: jest.fn(), escalar: jest.fn() }));
jest.mock('../../services/solicitudes.service', () => ({ aprobar: jest.fn(), rechazar: jest.fn() }));
const { prisma } = require('../../config/database');
const { registrarAuditoria } = require('../../middlewares/auditLog');
const novedades = require('../novedades.controller');
const solicitudes = require('../solicitudes.controller');
const novedadesService = require('../../services/novedades.service');
const solicitudesService = require('../../services/solicitudes.service');
const { ROLES } = require('../../constants/roles');
const { ESTADO_NOVEDAD, ESTADO_SOLICITUD } = require('../../constants/estados');
const casos = [
  ['asignar', 'novedades', 'novedad', novedades, novedadesService, ESTADO_NOVEDAD.ABIERTA, ESTADO_NOVEDAD.EN_ATENCION],
  ['escalar', 'novedades', 'novedad', novedades, novedadesService, ESTADO_NOVEDAD.ABIERTA, ESTADO_NOVEDAD.ESCALADA],
  ['resolver', 'novedades', 'novedad', novedades, novedadesService, ESTADO_NOVEDAD.ESCALADA, ESTADO_NOVEDAD.RESUELTA],
  ['aprobar', 'solicitudes', 'solicitud', solicitudes, solicitudesService, ESTADO_SOLICITUD.PENDIENTE, ESTADO_SOLICITUD.APROBADA],
  ['rechazar', 'solicitudes', 'solicitud', solicitudes, solicitudesService, ESTADO_SOLICITUD.PENDIENTE, ESTADO_SOLICITUD.RECHAZADA],
];
beforeEach(() => jest.resetAllMocks());
describe.each(casos)('%s: auditoría', (accion, tabla, modelo, controller, service, previo, nuevo) => {
  const req = { params: { id: 'n1' }, user: { id: 's1', rol: ROLES.SUPERVISOR },
    body: { comentario: 'Todo correcto', motivo: 'Sin cobertura', responsable_id: 's2' },
    ip: '127.0.0.1', get: () => 'Jest',
  };
  test('registra una vez los valores antes/después y el actor', async () => {
    prisma[modelo].findUnique.mockResolvedValue({ id: 'n1', estado: previo });
    service[accion].mockResolvedValue({ id: 'n1', estado: nuevo });
    const res = { json: jest.fn() }, next = jest.fn();
    await controller[accion](req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(registrarAuditoria).toHaveBeenCalledTimes(1);
    expect(registrarAuditoria).toHaveBeenCalledWith({ usuarioId: 's1', accion,
      tablaAfectada: tabla, registroId: 'n1', valoresAntes: { id: 'n1', estado: previo },
      valoresDespues: { id: 'n1', estado: nuevo }, ip: '127.0.0.1', userAgent: 'Jest' });
  });
  test('no registra una operación rechazada', async () => {
    service[accion].mockRejectedValue(Object.assign(new Error('Denegado'), { statusCode: 403 }));
    const res = { json: jest.fn() }, next = jest.fn();
    await controller[accion](req, res, next);
    expect(next).toHaveBeenCalled();
    expect(registrarAuditoria).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
