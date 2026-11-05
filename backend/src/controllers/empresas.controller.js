const empresasService = require('../services/empresas.service');
const { desconectarEmpresa } = require('../socket/socketManager');

const actorDe = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.get('user-agent') });

const listar = async (req, res, next) => {
  try { res.json({ data: await empresasService.listar() }); } catch (e) { next(e); }
};

const obtener = async (req, res, next) => {
  try { res.json(await empresasService.obtener(req.params.id)); } catch (e) { next(e); }
};

const crear = async (req, res, next) => {
  try { res.status(201).json(await empresasService.crear(req.body, actorDe(req))); } catch (e) { next(e); }
};

const editar = async (req, res, next) => {
  try { res.json(await empresasService.editar(req.params.id, req.body, actorDe(req))); } catch (e) { next(e); }
};

const cambiarEstado = async (req, res, next) => {
  try {
    res.json(await empresasService.cambiarEstado(req.params.id, req.body?.estado, actorDe(req), { desconectar: desconectarEmpresa }));
  } catch (e) { next(e); }
};

const crearPrimerAdmin = async (req, res, next) => {
  try { res.status(201).json(await empresasService.crearPrimerAdmin(req.params.id, req.body, actorDe(req))); } catch (e) { next(e); }
};

module.exports = { listar, obtener, crear, editar, cambiarEstado, crearPrimerAdmin };
