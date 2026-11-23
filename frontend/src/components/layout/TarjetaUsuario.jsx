import { toast } from "sonner";
import { FONT, T } from "../../theme/theme";
import { Icon } from "../ui/Icon";

const iniciales = (nombre) => String(nombre || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

const copiar = async (texto, mensaje) => {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(mensaje);
  } catch {
    toast.error("No se pudo copiar.");
  }
};

/** Credencial del usuario en el menú lateral: avatar, nombre, rol, empresa, instalación e identificador. */
export function TarjetaUsuario({ user, etiquetaRol, iconoRol }) {
  const instalacion = user.instalacion_asignada?.nombre;
  const fila = { display: "flex", alignItems: "center", gap: 8, fontSize: 12, minWidth: 0 };
  const texto = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  return (
    <section aria-label="Tu credencial" style={{
      background: `linear-gradient(160deg, ${T.focusGhost}, transparent 70%), ${T.bgCard}`,
      border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 14, marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div aria-hidden="true" style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
          background: T.focusGhost, border: `1px solid ${T.focus}`, color: T.focusText,
          fontWeight: 700, fontSize: 16, fontFamily: FONT.ui, letterSpacing: "0.02em",
        }}>{iniciales(user.nombre)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: T.text, lineHeight: 1.25, ...texto }} title={user.nombre}>{user.nombre}</div>
          {user.email && <div style={{ fontSize: 11, color: T.textMut, marginTop: 2, ...texto }} title={user.email}>{user.email}</div>}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        <span style={{
          ...fila, width: "auto", padding: "3px 9px", borderRadius: 999, color: T.focusText,
          background: T.focusGhost, border: `1px solid ${T.focus}`, fontWeight: 600,
        }}>
          <Icon name={iconoRol} size={13} color={T.focusText} />{etiquetaRol}
        </span>
        <span style={{ ...fila, width: "auto", padding: "3px 9px", borderRadius: 999, color: T.accent, background: T.accentGhost, border: `1px solid ${T.accent}` }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent }} />Sesión activa
        </span>
      </div>

      {(user.empresa?.nombre || instalacion) && (
        <div style={{ display: "grid", gap: 6, marginTop: 12, color: T.textSec }}>
          {user.empresa?.nombre && <div style={fila}><Icon name="building-2" size={14} color={T.textMut} /><span style={texto} title={user.empresa.nombre}>{user.empresa.nombre}</span></div>}
          {instalacion && <div style={fila}><Icon name="map-pin" size={14} color={T.textMut} /><span style={texto} title={instalacion}>{instalacion}</span></div>}
        </div>
      )}

      <button type="button" className="gc-accion-btn" onClick={() => copiar(user.id, "ID copiado")}
        aria-label="Copiar ID de usuario" title="Copiar ID completo" style={{
          marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "6px 10px",
          color: T.textMut, fontFamily: FONT.mono, fontSize: 11, cursor: "pointer",
        }}>
        <span>ID {String(user.id).slice(0, 8)}…</span>
        <Icon name="copy" size={13} color={T.textMut} />
      </button>
    </section>
  );
}
