const dashboardService = require('../services/dashboard.service');

const obtenerKPIs = async (req, res, next) => {
  try {
    const kpis = await dashboardService.obtenerKPIs(req.user);
    res.json(kpis);
  } catch (error) {
    next(error);
  }
};

const guardiasActivos = async (req, res, next) => {
  try {
    const guardias = await dashboardService.guardiasActivos(req.user);
    res.json(guardias);
  } catch (error) {
    next(error);
  }
};

module.exports = { obtenerKPIs, guardiasActivos };
