/**
 * Niveles de urgencia de una Novedad (Informe de Formulación, Escalación de novedades).
 * Ver también services/priorizacion.service.js, que asigna estos valores por tipo de novedad.
 */
const URGENCIAS = {
  ROJO: 'rojo',
  AMARILLO: 'amarillo',
  VERDE: 'verde',
};

module.exports = { URGENCIAS };
