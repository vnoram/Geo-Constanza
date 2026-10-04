import { T } from "../../theme/theme";

// Solo tres estados: ok (verde), alerta (naranja) y atención (naranja claro).
export function Badge({ color = "accent", children }) {
  const colors = {
    accent: { bg: T.accentGhost, text: T.accent },
    red: { bg: T.alertGhost, text: T.alert },
    yellow: { bg: T.yellowGhost, text: T.yellow },
    focus: { bg: T.focusGhost, text: T.focusText },
  };
  const c = colors[color] || colors.accent;
  return (
    <span style={{
      background: c.bg, color: c.text, padding: "2px 8px",
      borderRadius: T.radius, fontSize: 11, fontWeight: 600, lineHeight: "18px",
      display: "inline-block", whiteSpace: "nowrap",
    }}><span className="sentence">{children}</span></span>
  );
}
