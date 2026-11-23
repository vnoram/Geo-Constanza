// Presentación de la ficha de una instalación (ver components/ui/FichaInstalacion.jsx).

export const ESTADO_TURNO = {
  presente:    { texto: "En turno",    color: "#4CC38A" },
  tardio:      { texto: "Tardío",      color: "#F0A35E" },
  faltante:    { texto: "Sin marcar",  color: "#E86A2A" },
  por_iniciar: { texto: "Por iniciar", color: "#7C8F85" },
  finalizado:  { texto: "Finalizado",  color: "#7C8F85" },
};

export const COLOR_URGENCIA = { rojo: "#E86A2A", amarillo: "#F0A35E", verde: "#4CC38A" };

export const horaChile = (iso) =>
  new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
