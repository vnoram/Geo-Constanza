import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function SupNovedades() {
  const novedades = [
    { tipo: "Acceso no autorizado", urgencia: "rojo", guardia: "M. López", inst: "CC Arauco", hora: "06:23", desc: "Persona intentó ingresar por acceso trasero" },
    { tipo: "Mantenimiento", urgencia: "amarillo", guardia: "R. Soto", inst: "Edif. Atlas", hora: "07:15", desc: "Cámara sector B sin señal" },
    { tipo: "Sin novedad", urgencia: "verde", guardia: "J. García", inst: "Cond. Los Álamos", hora: "08:00", desc: "Ronda completada sin incidentes" },
  ];
  return (
    <div>
      <SectionHeader title="Novedades" sub="Ordenadas por prioridad" />
      {novedades.map((n, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          borderLeft: `4px solid ${n.urgencia === "rojo" ? T.red : n.urgencia === "amarillo" ? T.yellow : T.accent}`,
          padding: 14, marginBottom: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{n.tipo}</span>
            <Badge color={n.urgencia === "rojo" ? "red" : n.urgencia === "amarillo" ? "yellow" : "accent"}>{n.urgencia}</Badge>
          </div>
          <div style={{ fontSize: 12, color: T.textMut }}>{n.guardia} · {n.inst} · {n.hora}</div>
          <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>{n.desc}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Btn>Contactar</Btn>
            <Btn variant="ghost">Resolver</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}
