const novedadesService = require('../services/novedades.service');
const { prisma } = require('../config/database');
const { registrarAuditoria } = require('../middlewares/auditLog');
const { ACCION_NOVEDAD } = require('../constants/accionesNovedad');

const auditar = (req, accion, antes, despues) => registrarAuditoria({
  usuarioId: req.user.id, accion, tablaAfectada: 'novedades', registroId: req.params.id,
  valoresAntes: antes ? JSON.parse(JSON.stringify(antes)) : null,
  valoresDespues: JSON.parse(JSON.stringify(despues)), ip: req.ip, userAgent: req.get('user-agent'),
});

const listar = async (req, res, next) => {
  try {
    const result = await novedadesService.listar(req.query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const obtener = async (req, res, next) => {
  try {
    const novedad = await novedadesService.obtenerPorId(req.params.id, req.user);
    res.json(novedad);
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const novedad = await novedadesService.crear(req.body, req.file, req.user);
    res.status(201).json(novedad);
  } catch (error) {
    next(error);
  }
};

const resolver = async (req, res, next) => {
  try {
    const antes = await prisma.novedad.findUnique({ where: { id: req.params.id } });
    const { comentario } = req.body;
    const novedad = await novedadesService.resolver(req.params.id, comentario, req.user);
    await auditar(req, ACCION_NOVEDAD.RESOLVER, antes, novedad);
    res.json(novedad);
  } catch (error) {
    next(error);
  }
};

const escalar = async (req, res, next) => {
  try {
    const antes = await prisma.novedad.findUnique({ where: { id: req.params.id } });
    const novedad = await novedadesService.escalar(req.params.id, req.user);
    await auditar(req, ACCION_NOVEDAD.ESCALAR, antes, novedad);
    res.json(novedad);
  } catch (error) {
    next(error);
  }
};

const asignar = async (req, res, next) => {
  try {
    const antes = await prisma.novedad.findUnique({ where: { id: req.params.id } });
    const novedad = await novedadesService.asignar(req.params.id, req.body.responsable_id, req.user);
    await auditar(req, ACCION_NOVEDAD.ASIGNAR, antes, novedad);
    res.json(novedad);
  } catch (error) { next(error); }
};
const responsables = async (req, res, next) => {
  try { res.json(await novedadesService.responsables(req.params.id, req.user)); }
  catch (error) { next(error); }
};

const historial = async (req, res, next) => {
  try { res.json(await novedadesService.historial(req.params.id, req.user)); }
  catch (error) { next(error); }
};
module.exports = { listar, obtener, crear, resolver, escalar, asignar, responsables, historial };
