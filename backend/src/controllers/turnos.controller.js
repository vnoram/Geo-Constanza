const turnosService = require('../services/turnos.service');
const { registrarAuditoria } = require('../middlewares/auditLog');

const listar = async (req, res, next) => {
  try {
    const result = await turnosService.listar(req.query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const obtener = async (req, res, next) => {
  try {
    const turno = await turnosService.obtenerPorId(req.params.id);
    res.json(turno);
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const turno = await turnosService.crear(req.body, req.user.id);

    await registrarAuditoria({
      usuarioId: req.user.id,
      accion: 'crear',
      tablaAfectada: 'turnos',
      registroId: turno.id,
      valoresDespues: req.body,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json(turno);
  } catch (error) {
    next(error);
  }
};

const crearLote = async (req, res, next) => {
  try {
    const result = await turnosService.crearLote(req.body, req.user.id);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const editar = async (req, res, next) => {
  try {
    const turno = await turnosService.editar(req.params.id, req.body, req.user.id);

    await registrarAuditoria({
      usuarioId: req.user.id,
      accion: 'editar',
      tablaAfectada: 'turnos',
      registroId: req.params.id,
      valoresDespues: req.body,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json(turno);
  } catch (error) {
    next(error);
  }
};

const cancelar = async (req, res, next) => {
  try {
    const { motivo } = req.body;
    await turnosService.cancelar(req.params.id, motivo, req.user.id);
    res.json({ message: 'Turno cancelado correctamente' });
  } catch (error) {
    next(error);
  }
};

const verificarConflictos = async (req, res, next) => {
  try {
    const conflictos = await turnosService.verificarConflictos(req.query);
    res.json(conflictos);
  } catch (error) {
    next(error);
  }
};

const crearPauta4x4 = async (req, res, next) => {
  try {
    const result = await turnosService.crearPauta4x4(req.body, req.user.id);

    await registrarAuditoria({
      usuarioId: req.user.id,
      accion: 'crear_pauta_4x4',
      tablaAfectada: 'turnos',
      registroId: req.body.usuario_id,
      valoresDespues: req.body,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, obtener, crear, crearLote, crearPauta4x4, editar, cancelar, verificarConflictos };
