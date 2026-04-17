const asistenciaService = require('../services/asistencia.service');

const registrarEntrada = async (req, res, next) => {
  try {
    const result = await asistenciaService.registrarEntrada(req.body, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /asistencia/entrada-tablet
 * Entrada principal desde tablet fija (GGSS en pauta).
 */
const registrarEntradaTablet = async (req, res, next) => {
  try {
    const result = await asistenciaService.registrarEntradaTablet(req.body, req.user);
    res.status(201).json({ ...result, dispositivo_usado: 'tablet', es_fallback: false });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /asistencia/entrada-fallback
 * Entrada desde móvil (fallback).
 * - GGSS pauta: siempre permitido, registra es_fallback=true
 * - GGSS libre: solo si tiene turno aprobado hoy
 */
const registrarEntradaFallback = async (req, res, next) => {
  try {
    const result = await asistenciaService.registrarEntradaFallback(req.body, req.user);
    res.status(201).json({ ...result, dispositivo_usado: 'mobil_empresa', es_fallback: true });
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

const obtenerEstadoActual = async (req, res, next) => {
  try {
    // El usuarioId lo tomamos del token autenticado para evitar IDOR
    const result = await asistenciaService.obtenerEstadoActual(req.user.id);
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

module.exports = {
  registrarEntrada,
  registrarEntradaTablet,
  registrarEntradaFallback,
  registrarSalida,
  obtenerHoy,
  obtenerHistorial,
  obtenerEstadoActual,
  sincronizarOffline,
};
