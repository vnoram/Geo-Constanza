import { T } from "../../theme/theme";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function LibreSolicitudes() {
  return (
    <div className="guard-screen">
      <SectionHeader title="Solicitudes" sub="Gestiona tus peticiones" action={{ label: "+ Nueva", onClick: () => {} }} />
      <div className="guard-action-grid" style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {[
          { icon: "🏖️", label: "Vacaciones" },
          { icon: "➕", label: "Turno Extra" },
          { icon: "🚫", label: "Ausencia" },
          { icon: "🔄", label: "Cambio Inst." },
        ].map((t, i) => (
          <button className="touch-target" key={i} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: "14px 10px", color: T.text, fontSize: 12, fontWeight: 600,
            cursor: "pointer", textAlign: "center", fontFamily: "var(--font-ui)",
            transition: "all 0.15s",
          }}>{t.icon} {t.label}</button>
        ))}
      </div>
      <div style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 13 }}>
        📝 No tienes solicitudes activas
      </div>
    </div>
  );
}
