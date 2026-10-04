export const ZONA_CHILE = "America/Santiago";

const formato = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_CHILE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function ahoraChile(fecha = new Date()) {
  const partes = Object.fromEntries(
    formato.formatToParts(fecha).map((parte) => [parte.type, parte.value]),
  );
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
  };
}

export function sumarDias(fechaISO, dias) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}
