import { useState } from "react";
import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function PautaNovedades({ user }) {
  const [novedades] = useState([
    { id: 1, tipo: "Acceso no autorizado", urgencia: "rojo", hora: "06:23", desc: "Persona intentó ingresar por acceso trasero", estado: "abierta" },
    { id: 2, tipo: "Sin novedad", urgencia: "verde", hora: "08:00", desc: "Ronda completada sin incidentes", estado: "resuelta" },
  ]);

  return (
    <div>
      <SectionHeader title="Novedades" sub="Reporta incidencias durante tu turno" action={{ label: "+ Reportar", onClick: () => {} }} />
      {novedades.map(n => (
        <div key={n.id} style={{
          background: T.bgCard, border: `1px solid ${T.border}`,
          borderLeft: `4px solid ${n.urgencia === "rojo" ? T.red : n.urgencia === "amarillo" ? T.yellow : T.accent}`,
          borderRadius: 12, padding: 14, marginBottom: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{n.tipo}</span>
            <Badge color={n.urgencia === "rojo" ? "red" : n.urgencia === "amarillo" ? "yellow" : "accent"}>{n.urgencia}</Badge>
          </div>
          <div style={{ fontSize: 12, color: T.textMut }}>{n.hora} · {n.desc}</div>
          <div style={{ marginTop: 6 }}><Badge color={n.estado === "abierta" ? "yellow" : "accent"}>{n.estado}</Badge></div>
        </div>
      ))}
    </div>
  );
}
