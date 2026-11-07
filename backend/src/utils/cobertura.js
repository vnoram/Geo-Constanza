const { intervaloTurno } = require('./fechaChile');
const { toleranciaInstalacion } = require('../constants/cobertura');
const { ESTADO_TURNO } = require('../constants/estados');
const sinCobertura = (turno, ahora = new Date()) => {
  if (turno.estado !== ESTADO_TURNO.PROGRAMADO || turno.asistencias?.length) return false;
  const { inicio, fin } = intervaloTurno(turno);
  const margen = turno.usuario_id ? toleranciaInstalacion(turno.instalacion) : 0;
  return ahora.getTime() >= inicio.getTime() + margen * 60000 && ahora < fin;
};
module.exports = { sinCobertura };
