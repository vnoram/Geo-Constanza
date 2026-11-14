import { T, FONT } from "../../theme/theme";
import { Badge } from "./Badge";
import { IconoFranja } from "./IconoFranja";
import { esRutina, horaNovedad } from "../../utils/novedades";

const URGENCIA = {
  rojo:     { color: T.red,    badge: "red" },
  amarillo: { color: T.yellow, badge: "yellow" },
  verde:    { color: T.accent, badge: "accent" },
};

// Tarjeta vertical para las celdas del calendario semanal: hora, tipo, descripción y estado ordenados en bloques.
export function NovedadMini({ n, onClick, instalacion }) {
  const urgencia = n.urgencia ?? "verde";
  const c = URGENCIA[urgencia] ?? URGENCIA.verde;
  const rutina = esRutina(n);
  const pendiente = !rutina && n.estado !== "resuelta";
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { type: "button", onClick, title: "Ver detalle", className: "touch-target nov-card-compacta" } : {})}
      style={{
        display: "flex", flexDirection: "column", gap: 6, width: "100%", textAlign: "left", boxSizing: "border-box",
        background: T.bgCard, border: `1px solid ${T.border}`, borderLeft: `3px solid ${c.color}`,
        borderRadius: T.radius, padding: "8px 10px", fontFamily: FONT.ui, color: T.text,
        cursor: onClick ? "pointer" : "default", minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{
          fontFamily: FONT.mono, fontWeight: 800, fontSize: 14, whiteSpace: "nowrap",
          background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "2px 7px",
        }}>{horaNovedad(n.created_at)}</span>
        {!rutina && <Badge color={c.badge}>{urgencia}</Badge>}
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.25, color: c.color, overflowWrap: "break-word", minWidth: 0 }}>{n.tipo}</span>
        <span style={{ marginTop: 1 }}><IconoFranja fecha={n.created_at} /></span>
      </div>
      {instalacion && <div style={{ fontSize: 11, color: T.focusText, fontWeight: 600 }}>{instalacion}</div>}
      {n.descripcion && (
        <div style={{
          fontSize: 12, lineHeight: 1.35, color: T.textSec, overflowWrap: "break-word",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>{n.descripcion}</div>
      )}
      {(pendiente || n.gps_dentro_rango === false) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {pendiente && <Badge color={n.estado === "escalada" ? "red" : n.estado === "abierta" ? "yellow" : "accent"}>{String(n.estado).replace("_", " ")}</Badge>}
          {n.gps_dentro_rango === false && <Badge color="yellow">GPS fuera</Badge>}
        </div>
      )}
    </Tag>
  );
}
