import { T } from "../../theme/theme";

export function Placeholder({ icon = "🚧", title = "En construcción", sub = "Esta sección estará disponible próximamente" }) {
  return (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: 40, textAlign: "center",
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: T.textMut }}>{sub}</div>
    </div>
  );
}
