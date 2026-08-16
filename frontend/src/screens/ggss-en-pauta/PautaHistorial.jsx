import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function PautaHistorial() {
  const data = [
    { fecha: "09 Abr", entrada: "06:02", salida: "—", estado: "En curso", horas: "—" },
    { fecha: "08 Abr", entrada: "06:12", salida: "14:00", estado: "Tardío", horas: "7h 48m" },
    { fecha: "07 Abr", entrada: "06:00", salida: "14:10", estado: "Normal", horas: "8h 10m" },
    { fecha: "06 Abr", entrada: "05:58", salida: "14:05", estado: "Normal", horas: "8h 07m" },
  ];
  return (
    <div>
      <SectionHeader title="Historial" sub="Tu registro de asistencia" />
      {data.map((h, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{h.fecha}</div>
            <div style={{ fontSize: 11, color: T.textMut }}>{h.entrada} → {h.salida}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Badge color={h.estado === "Normal" ? "accent" : h.estado === "En curso" ? "yellow" : "red"}>{h.estado}</Badge>
            <div style={{ fontSize: 10, color: T.textMut, marginTop: 4 }}>{h.horas}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
