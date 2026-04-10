const instalacionesService = require('../services/instalaciones.service');
const { registrarAuditoria } = require('../middlewares/auditLog');

const listar = async (req, res, next) => {
  try {
    const result = await instalacionesService.listar(req.query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const instalacion = await instalacionesService.crear(req.body);

    await registrarAuditoria({
      usuarioId: req.user.id,
      accion: 'crear',
      tablaAfectada: 'instalaciones',
      registroId: instalacion.id,
      valoresDespues: req.body,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json(instalacion);
  } catch (error) {
    next(error);
  }
};

const editar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const instalacion = await instalacionesService.editar(id, req.body);

    await registrarAuditoria({
      usuarioId: req.user.id,
      accion: 'editar',
      tablaAfectada: 'instalaciones',
      registroId: id,
      valoresDespues: req.body,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json(instalacion);
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, crear, editar };
