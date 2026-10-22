import { T, FONT } from "../../theme/theme";

// Símbolo: punto dentro de un anillo (una geocerca). Sin escudo.
export function GeoMark({ size = 24, ring = T.accent, dot = T.accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="12" cy="12" r="9.25" stroke={ring} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3.25" fill={dot} />
    </svg>
  );
}

export function Wordmark({ size = 15, markSize = 22 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap" }}>
      <GeoMark size={markSize} />
      <span style={{ fontFamily: FONT.ui, fontSize: size, fontWeight: 600, letterSpacing: "-0.01em", color: T.text }}>
        Geo Constanza
      </span>
    </span>
  );
}
