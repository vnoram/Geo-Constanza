const TIPO_SOLICITUD = {
  VACACIONES: 'vacaciones', DIAS_LIBRES: 'dias_libres', TURNO_EXTRA: 'turno_extra',
  TRASLADO: 'traslado', TURNO: 'turno', COBERTURA: 'cobertura',
};
const TIPOS_COBERTURA = [TIPO_SOLICITUD.TURNO, TIPO_SOLICITUD.TURNO_EXTRA, TIPO_SOLICITUD.COBERTURA];
// Solicitudes que justifican no trabajar: así se rotula al guardia en el dashboard en vez de "Faltante".
const AUSENCIAS = { [TIPO_SOLICITUD.VACACIONES]: 'Vacaciones', [TIPO_SOLICITUD.DIAS_LIBRES]: 'Ausencia autorizada' };
module.exports = { TIPO_SOLICITUD, TIPOS_COBERTURA, AUSENCIAS };
