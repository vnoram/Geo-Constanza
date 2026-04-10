import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function SupSolicitudes() {
  const sols = [
    { guardia: "V. Norambuena", tipo: "Vacaciones", fechas: "21-25 Abr", estado: "Pendiente" },
    { guardia: "M. López", tipo: "Turno Extra", fechas: "13 Abr", estado: "Pendiente" },
  ];
  return (
    <div>
      <SectionHeader title="Solicitudes" sub="Pendientes de aprobación" />
      {sols.map((s, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, marginBottom: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{s.guardia}</span>
            <Badge color="yellow">{s.estado}</Badge>
          </div>
          <div style={{ fontSize: 12, color: T.textMut }}>{s.tipo}: {s.fechas}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Btn>Aprobar</Btn>
            <Btn variant="ghost">Rechazar</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}
