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

/** Lista de fechas ISO entre dos días, ambos incluidos (acepta el rango al revés). */
export function rangoDias(desde, hasta) {
  const [a, b] = desde <= hasta ? [desde, hasta] : [hasta, desde];
  const lista = [];
  for (let d = a; d <= b; d = sumarDias(d, 1)) lista.push(d);
  return lista;
}

/** Lunes de la semana de una fecha ISO. */
export function lunesDe(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return sumarDias(iso, -((dow + 6) % 7));
}
