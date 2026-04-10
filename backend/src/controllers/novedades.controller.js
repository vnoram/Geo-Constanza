const novedadesService = require('../services/novedades.service');

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
    const { comentario } = req.body;
    const novedad = await novedadesService.resolver(req.params.id, comentario, req.user.id);
    res.json(novedad);
  } catch (error) {
    next(error);
  }
};

const escalar = async (req, res, next) => {
  try {
    const novedad = await novedadesService.escalar(req.params.id, req.user.id);
    res.json(novedad);
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, obtener, crear, resolver, escalar };
