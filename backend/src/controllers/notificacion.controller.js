const { registrarToken } = require('../services/notificacion.service');
const registrarDispositivo = async (req, res, next) => {
  try { res.json(await registrarToken(req.user.id, req.body.token)); }
  catch (error) { next(error); }
};
module.exports = { registrarDispositivo };
