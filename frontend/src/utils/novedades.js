// Tipos de rutina (urgencia verde): van al "Libro de rondas", no cuentan como incidencia.
// Debe coincidir con MATRIZ_URGENCIA (backend/src/services/priorizacion.service.js).
export const TIPOS_RUTINA = ["Ronda", "Sin novedad", "Fin de ronda", "Cambio de turno"];
export const esRutina = (n) => TIPOS_RUTINA.includes(n?.tipo);
