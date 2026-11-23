import { FONT, T } from "../../theme/theme";
import { Icon } from "../ui/Icon";

const iniciales = (nombre) => String(nombre || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

/** Credencial del usuario en el menú lateral: avatar, nombre, rol, empresa, instalación e identificador. */
export function TarjetaUsuario({ user, etiquetaRol, iconoRol, onAbrirPerfil }) {
  const instalacion = user.instalacion_asignada?.nombre;
  const fila = { display: "flex", alignItems: "center", gap: 8, fontSize: 12, minWidth: 0 };
  const texto = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  return (
    <section aria-label="Tu credencial" style={{
      background: `linear-gradient(160deg, ${T.focusGhost}, transparent 70%), ${T.bgCard}`,
      border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 14, marginBottom: 16,
    }}>
      <button type="button" className="gc-accion-btn" onClick={onAbrirPerfil} aria-label="Abrir tu perfil" title="Ver tu perfil" style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: "none", padding: 0,
        textAlign: "left", cursor: "pointer", color: "inherit", fontFamily: FONT.ui,
      }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div aria-hidden="true" style={{
            width: 44, height: 44, borderRadius: "50%", display: "grid", placeItems: "center",
            background: T.focusGhost, border: `1px solid ${T.focus}`, color: T.focusText,
            fontWeight: 700, fontSize: 16, letterSpacing: "0.02em",
          }}>{iniciales(user.nombre)}</div>
          <span aria-hidden="true" style={{
            position: "absolute", right: -3, bottom: -3, width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center",
            background: T.bgCard, border: `1px solid ${T.border}`,
          }}><Icon name="settings" size={11} color={T.focusText} /></span>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: T.text, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={user.nombre}>{user.nombre}</div>
          {user.email && <div style={{ fontSize: 11, color: T.textMut, marginTop: 2, ...texto }} title={user.email}>{user.email}</div>}
        </div>
      </button>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        <span style={{
          ...fila, width: "auto", padding: "3px 9px", borderRadius: 999, color: T.focusText,
          background: T.focusGhost, border: `1px solid ${T.focus}`, fontWeight: 600,
        }}>
          <Icon name={iconoRol} size={13} color={T.focusText} />{etiquetaRol}
        </span>
      </div>

      {(user.empresa?.nombre || instalacion) && (
        <div style={{ display: "grid", gap: 6, marginTop: 12, color: T.textSec }}>
          {user.empresa?.nombre && <div style={fila}><Icon name="building-2" size={14} color={T.textMut} /><span style={texto} title={user.empresa.nombre}>{user.empresa.nombre}</span></div>}
          {instalacion && <div style={fila}><Icon name="map-pin" size={14} color={T.textMut} /><span style={texto} title={instalacion}>{instalacion}</span></div>}
        </div>
      )}
    </section>
  );
}
