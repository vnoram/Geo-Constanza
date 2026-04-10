import { T } from "../../theme/theme";
import { Btn } from "./Btn";

export function SectionHeader({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>{title}</h2>
        {sub && <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textMut }}>{sub}</p>}
      </div>
      {action && <Btn onClick={action.onClick}>{action.label}</Btn>}
    </div>
  );
}
