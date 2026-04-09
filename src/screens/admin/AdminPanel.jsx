import { T } from "../../theme/theme";
import { KPI } from "../../components/ui/KPI";
import { SubHeader } from "../../components/ui/SubHeader";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function AdminPanel() {
  return (
    <div>
      <SectionHeader title="Panel Central" sub="Vista general del sistema" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <KPI label="Guardias" value="127" sub="activos" accent="#B98CFF" />
        <KPI label="Instalaciones" value="23" sub="operativas" accent="#B98CFF" />
        <KPI label="Turnos Hoy" value="45" sub="programados" accent={T.accent} />
        <KPI label="Cobertura" value="96%" sub="mensual" accent={T.accent} />
      </div>
      <SubHeader title="Acciones Rápidas" />
      {["Crear Usuario", "Nueva Instalación", "Importar Turnos (Lote)", "Auditoría de Cambios", "Configuración"].map((a, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 13, marginBottom: 5, display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        }}>
          <span style={{ fontSize: 15 }}>{["👤", "🏢", "📥", "🔍", "⚙️"][i]}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{a}</span>
        </div>
      ))}
    </div>
  );
}
