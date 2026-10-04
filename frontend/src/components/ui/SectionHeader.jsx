import { T, FONT } from "../../theme/theme";

export function SectionHeader({ title, sub, action }) {
  return (
    <div className="responsive-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16, gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <h2 className="fluid-title" style={{ margin: 0, fontSize: 20, fontWeight: 600, color: T.text, letterSpacing: "-0.01em", fontFamily: FONT.ui }}>{title}</h2>
        {sub && <div style={{ fontSize: 12, color: T.textSec, marginTop: 3 }}>{sub}</div>}
      </div>
      {action && (
        <button className="touch-target" onClick={action.onClick} style={{
          background: T.alert, color: T.ink, border: "1px solid transparent", borderRadius: T.radius,
          padding: "0 14px", minHeight: 36, fontWeight: 600, fontSize: 13, cursor: "pointer",
          fontFamily: FONT.ui, whiteSpace: "nowrap",
        }}>{action.label}</button>
      )}
    </div>
  );
}
