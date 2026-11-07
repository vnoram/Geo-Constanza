const solicitudesService = require('../services/solicitudes.service');
const { prisma } = require('../config/database');
const { registrarAuditoria } = require('../middlewares/auditLog');

const auditar = (req, accion, antes, despues) => registrarAuditoria({
  usuarioId: req.user.id, accion, tablaAfectada: 'solicitudes', registroId: req.params.id,
  valoresAntes: antes ? JSON.parse(JSON.stringify(antes)) : null,
  valoresDespues: JSON.parse(JSON.stringify(despues)), ip: req.ip, userAgent: req.get('user-agent'),
});

const listar = async (req, res, next) => {
  try {
    const result = await solicitudesService.listar(req.query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const solicitud = await solicitudesService.crear(req.body, req.user.id);
    res.status(201).json(solicitud);
  } catch (error) {
    next(error);
  }
};

const aprobar = async (req, res, next) => {
  try {
    const antes = await prisma.solicitud.findUnique({ where: { id: req.params.id } });
    const { comentario } = req.body;
    const solicitud = await solicitudesService.aprobar(req.params.id, req.user.id, comentario, req.user);
    await auditar(req, 'aprobar', antes, solicitud);
    res.json(solicitud);
  } catch (error) {
    next(error);
  }
};

const rechazar = async (req, res, next) => {
  try {
    const antes = await prisma.solicitud.findUnique({ where: { id: req.params.id } });
    const { motivo } = req.body;
    const solicitud = await solicitudesService.rechazar(req.params.id, motivo, req.user.id, req.user);
    await auditar(req, 'rechazar', antes, solicitud);
    res.json(solicitud);
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, crear, aprobar, rechazar };
