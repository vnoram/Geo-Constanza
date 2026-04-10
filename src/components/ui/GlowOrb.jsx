export function GlowOrb({ x = "0%", y = "0%", color = "rgba(0,229,176,0.15)", size = 300 }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y,
      width: size, height: size, borderRadius: "50%",
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      pointerEvents: "none", zIndex: 0,
    }} />
  );
}
