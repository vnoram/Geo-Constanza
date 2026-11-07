const { getDashboardHoy, getEstadoSupervisores } = require('../services/dashboard.service');
const { getInsight } = require('../services/insight.service');

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

// Línea base y alertas por reglas. ?dias=7..90 (por defecto 30).
const insight = async (req, res, next) => {
  try {
    const dias = req.query.dias === undefined ? 30 : Number(req.query.dias);
    if (!Number.isInteger(dias) || dias < 7 || dias > 90) {
      return res.status(400).json({ error: 'El parámetro dias debe ser un entero entre 7 y 90' });
    }
    const data = await getInsight(req.user, { dias });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

module.exports = { hoy, estadoSupervisores, insight };
