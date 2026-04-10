import { T } from "../../theme/theme";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function SupReportes() {
  return (
    <div>
      <SectionHeader title="Reportes" sub="Genera informes operacionales" />
      {["Asistencia del Día", "Incidentes del Período", "Cumplimiento Rondas", "Exportar PDF", "Exportar Excel"].map((r, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, marginBottom: 6, display: "flex", justifyContent: "space-between",
          alignItems: "center", cursor: "pointer",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>{["📋", "🚨", "✅", "📑", "📊"][i]}</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{r}</span>
          </div>
          <span style={{ color: T.textMut, fontSize: 14 }}>→</span>
        </div>
      ))}
    </div>
  );
}
