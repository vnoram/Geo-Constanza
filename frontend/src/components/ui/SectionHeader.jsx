import { T } from "../../theme/theme";

export function SectionHeader({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>{title}</h2>
        {sub && <div style={{ fontSize: 12, color: T.textMut, marginTop: 3 }}>{sub}</div>}
      </div>
      {action && (
        <button onClick={action.onClick} style={{
          background: T.accent, color: T.bg, border: "none", borderRadius: 10,
          padding: "8px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer",
          fontFamily: "'Outfit', sans-serif",
        }}>{action.label}</button>
      )}
    </div>
  );
}
