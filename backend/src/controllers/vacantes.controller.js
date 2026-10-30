const vacantes = require('../services/vacantes.service');
const listar = async (req, res, next) => {
  try { res.json(await vacantes.listarCompatibles(req.user)); } catch (error) { next(error); }
};
const solicitar = async (req, res, next) => {
  try { res.status(201).json(await vacantes.solicitar(req.body.vacante_turno_id, req.user, req.body.motivo)); }
  catch (error) { next(error); }
};
module.exports = { listar, solicitar };
