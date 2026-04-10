export function GlowOrb({ x, y, color, size }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: size, height: size,
      borderRadius: "50%", background: color, filter: "blur(80px)",
      opacity: 0.4, pointerEvents: "none",
    }} />
  );
}
