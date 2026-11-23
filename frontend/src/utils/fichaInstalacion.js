import { escaparHtml } from "./html";

// Contenido HTML del popup de una instalación en el mapa (Leaflet no usa JSX).
// Todo texto que viene de la API se escapa con escaparHtml.

const ESTADO_TURNO = {
  presente:    { texto: "En turno",   color: "#4CC38A" },
  tardio:      { texto: "Tardío",      color: "#F0A35E" },
  faltante:    { texto: "Sin marcar",  color: "#E86A2A" },
  por_iniciar: { texto: "Por iniciar", color: "#7C8F85" },
  finalizado:  { texto: "Finalizado",  color: "#7C8F85" },
};

const URGENCIA = { rojo: "#E86A2A", amarillo: "#F0A35E", verde: "#4CC38A" };
const MUTED = "#A8B7AE";
const TITULO = "font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#7C8F85;margin:10px 0 4px";

const hora = (iso) => new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });

export function htmlCabeceraInstalacion(inst, color) {
  const datos = [inst.tipo_recinto, inst.nivel_criticidad && `Criticidad ${inst.nivel_criticidad}`, `Radio ${inst.radio_geofence_m ?? 100} m`]
    .filter(Boolean).map(escaparHtml).join(" · ");
  const lugar = [inst.direccion, inst.comuna].filter(Boolean).map(escaparHtml).join(", ") || "—";
  return `<b style="font-size:13px">${escaparHtml(inst.nombre)}</b><br>` +
    `<span style="color:${MUTED};font-size:11px">${lugar}</span><br>` +
    `<span style="color:${color};font-size:11px">${datos}</span>`;
}

export function htmlFichaInstalacion(inst, resumen, color) {
  let html = htmlCabeceraInstalacion(inst, color);

  const turnos = resumen.turnos_hoy ?? [];
  html += `<div style="${TITULO}">De turno hoy</div>`;
  html += turnos.length === 0
    ? `<div style="color:${MUTED};font-size:11px">Sin turnos programados</div>`
    : turnos.map((t) => {
      const e = ESTADO_TURNO[t.estado] ?? ESTADO_TURNO.por_iniciar;
      const entrada = t.hora_entrada ? ` · entró ${hora(t.hora_entrada)}` : "";
      return `<div style="font-size:11px;margin:2px 0"><span style="color:${e.color}">●</span> ${escaparHtml(t.guardia)} ` +
        `<span style="color:${MUTED}">${escaparHtml(t.hora_inicio)}–${escaparHtml(t.hora_fin)}</span><br>` +
        `<span style="color:${e.color};font-size:10px;margin-left:14px">${e.texto}${entrada}</span></div>`;
    }).join("");

  const nov = resumen.novedades_abiertas ?? { total: 0, ultimas: [] };
  html += `<div style="${TITULO}">Novedades abiertas</div>`;
  if (nov.total === 0) {
    html += `<div style="color:${MUTED};font-size:11px">Ninguna</div>`;
  } else {
    const partes = ["rojo", "amarillo", "verde"].filter((u) => nov[u] > 0)
      .map((u) => `<span style="color:${URGENCIA[u]}">● ${nov[u]} ${u}</span>`).join("  ");
    html += `<div style="font-size:11px"><b>${nov.total}</b> · ${partes}</div>`;
    html += (nov.ultimas ?? []).map((n) =>
      `<div style="font-size:10px;color:${MUTED};margin-top:2px"><span style="color:${URGENCIA[n.urgencia] ?? MUTED}">●</span> #${escaparHtml(n.numero)} ${escaparHtml(n.tipo)}</div>`).join("");
  }

  const sups = resumen.supervisores ?? [];
  html += `<div style="${TITULO}">Supervisión</div>` +
    `<div style="color:${MUTED};font-size:11px">${sups.length ? sups.map(escaparHtml).join(", ") : "Sin supervisor asignado"}</div>`;
  return html;
}
