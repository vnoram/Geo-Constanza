import { Icon } from "../../components/ui/Icon";
import { T } from "../../theme/theme";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function LibreSolicitudes() {
  return (
    <div className="guard-screen">
      <SectionHeader title="Solicitudes" sub="Gestiona tus peticiones" action={{ label: "+ Nueva", onClick: () => {} }} />
      <div className="guard-action-grid" style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {[
          { icon: "umbrella", label: "Vacaciones" },
          { icon: "plus", label: "Turno Extra" },
          { icon: "ban", label: "Ausencia" },
          { icon: "refresh-cw", label: "Cambio Inst." },
        ].map((t, i) => (
          <button className="touch-target" key={i} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: "14px 10px", color: T.text, fontSize: 12, fontWeight: 600,
            cursor: "pointer", textAlign: "center", fontFamily: "var(--font-ui)",
            transition: "all 0.15s",
          }}><Icon name={t.icon} size={16} /> {t.label}</button>
        ))}
      </div>
      <div style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 13 }}>
        <Icon name="file-pen" size={16} /> No tienes solicitudes activas
      </div>
    </div>
  );
}
