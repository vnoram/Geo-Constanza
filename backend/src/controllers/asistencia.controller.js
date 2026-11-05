const asistenciaService = require('../services/asistencia.service');
const { ROLES } = require('../constants/roles');
const { prisma } = require('../config/database');

const noEncontrado = () => Object.assign(new Error('Registro no encontrado.'), { statusCode: 404 });

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
    // Una instalación que no existe en la empresa del token (o es de otra) responde 404, no una lista vacía.
    if (!await prisma.instalacion.findUnique({ where: { id: instalacionId }, select: { id: true } })) throw noEncontrado();
    const result = await asistenciaService.obtenerHoy(instalacionId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const obtenerHistorial = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;
    // Primero: el usuario debe existir en la empresa del token (uno de otra empresa responde 404).
    if (!await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } })) throw noEncontrado();
    // Un guardia solo puede ver su propio historial (evita IDOR)
    if ([ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE].includes(req.user.rol) && usuarioId !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para ver el historial de otro usuario.' });
    }
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
    const result = await asistenciaService.sincronizarBatch(registros, req.user);
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
