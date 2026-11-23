const { listarMias } = require('../services/alertasGuardia.service');

const mias = async (req, res, next) => {
  try {
    res.json({ data: await listarMias(req.user) });
  } catch (error) {
    next(error);
  }
};

module.exports = { mias };
