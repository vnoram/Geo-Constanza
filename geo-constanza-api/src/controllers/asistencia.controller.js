const asistenciaService = require('../services/asistencia.service');

const registrarEntrada = async (req, res, next) => {
  try {
    const result = await asistenciaService.registrarEntrada(req.body, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const registrarSalida = async (req, res, next) => {
  try {
    const result = await asistenciaService.registrarSalida(req.body, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const obtenerHoy = async (req, res, next) => {
  try {
    const { instalacionId } = req.params;
    const result = await asistenciaService.obtenerHoy(instalacionId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const obtenerHistorial = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;
    const result = await asistenciaService.obtenerHistorial(usuarioId, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const sincronizarOffline = async (req, res, next) => {
  try {
    const { registros } = req.body;
    const result = await asistenciaService.sincronizarBatch(registros);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { registrarEntrada, registrarSalida, obtenerHoy, obtenerHistorial, sincronizarOffline };
