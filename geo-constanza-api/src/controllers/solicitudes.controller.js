const solicitudesService = require('../services/solicitudes.service');

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
    const solicitud = await solicitudesService.aprobar(req.params.id, req.user.id);
    res.json(solicitud);
  } catch (error) {
    next(error);
  }
};

const rechazar = async (req, res, next) => {
  try {
    const { motivo } = req.body;
    const solicitud = await solicitudesService.rechazar(req.params.id, motivo, req.user.id);
    res.json(solicitud);
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, crear, aprobar, rechazar };
