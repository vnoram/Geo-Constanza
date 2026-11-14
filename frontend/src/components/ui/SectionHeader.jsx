import { T, FONT } from "../../theme/theme";
import { Btn } from "./Btn";

export function SectionHeader({ title, sub, action }) {
  return (
    <div className="responsive-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16, gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <h2 className="fluid-title" style={{ margin: 0, fontSize: 20, fontWeight: 600, color: T.focusText, letterSpacing: "-0.01em", fontFamily: FONT.ui }}>{title}</h2>
        {sub && <div style={{ fontSize: 12, color: T.textSec, marginTop: 3 }}>{sub}</div>}
      </div>
      {action && (
        <Btn variant="morado" onClick={action.onClick} style={{
          display: "inline-block", width: undefined, padding: "0 14px",
          minHeight: 36, fontSize: 13, whiteSpace: "nowrap", transition: "none",
        }}>{action.label}</Btn>
      )}
    </div>
  );
}
