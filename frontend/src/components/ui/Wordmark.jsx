import { T, FONT } from "../../theme/theme";
import logo from "../../assets/logo.png";

// Símbolo: punto dentro de un anillo (una geocerca). Sin escudo.
export function GeoMark({ size = 24, ring = T.accent, dot = T.accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="12" cy="12" r="9.25" stroke={ring} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3.25" fill={dot} />
    </svg>
  );
}

// conLogo: el logo de la empresa solo se usa dentro de la sesión; fuera (login, contraseña, 2FA) va el símbolo simple.
export function Wordmark({ size = 15, markSize = 22, conLogo = false }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap" }}>
      {conLogo
        ? <img src={logo} alt="" width={markSize + 8} height={markSize + 8} style={{ flex: "none", objectFit: "contain" }} />
        : <GeoMark size={markSize} />}
      <span style={{ fontFamily: FONT.ui, fontSize: size, fontWeight: 600, letterSpacing: "-0.01em", color: conLogo ? T.focusText : T.text }}>
        Geo Constanza
      </span>
    </span>
  );
}
