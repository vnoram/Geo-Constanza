const { getDashboardHoy, getEstadoSupervisores } = require('../services/dashboard.service');

const hoy = async (req, res, next) => {
  try {
    const data = await getDashboardHoy(req.user);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const estadoSupervisores = async (req, res, next) => {
  try {
    const data = await getEstadoSupervisores();
    res.json(data);
  } catch (error) {
    next(error);
  }
};

module.exports = { hoy, estadoSupervisores };
