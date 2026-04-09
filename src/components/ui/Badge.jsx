import { T } from "../../theme/theme";

export function Badge({ color = "accent", children }) {
  const colors = {
    accent: { bg: T.accentGhost, text: T.accent },
    red: { bg: T.redGhost, text: T.red },
    yellow: { bg: T.yellowGhost, text: T.yellow },
  };
  const c = colors[color] || colors.accent;
  return (
    <span style={{
      background: c.bg, color: c.text, padding: "3px 10px",
      borderRadius: 20, fontSize: 10, fontWeight: 800,
      letterSpacing: 0.8, textTransform: "uppercase",
    }}>{children}</span>
  );
}
