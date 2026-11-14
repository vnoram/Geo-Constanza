// Tipos de rutina (urgencia verde): van al "Libro de rondas", no cuentan como incidencia.
// Debe coincidir con MATRIZ_URGENCIA (backend/src/services/priorizacion.service.js).
export const TIPOS_RUTINA = ["Ronda", "Sin novedad", "Fin de ronda", "Cambio de turno"];
export const esRutina = (n) => TIPOS_RUTINA.includes(n?.tipo);

const formatoHora = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
// "HH:MM" en hora de Chile
export const horaNovedad = (iso) => (iso ? formatoHora.format(new Date(iso)) : "");
// Franja: día 07:00–18:59, noche 19:00–06:59
export const franjaDe = (iso) => {
  const h = Number(horaNovedad(iso).slice(0, 2));
  return h >= 7 && h < 19 ? "dia" : "noche";
};
// Franja de un turno según su hora de inicio "HH:MM" (mismo criterio que franjaDe)
export const franjaDeHora = (hhmm) => {
  const h = Number(String(hhmm).slice(0, 2));
  return h >= 7 && h < 19 ? "dia" : "noche";
};
