import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { FONT, T } from "../../theme/theme";
import { Btn } from "../ui/Btn";
import { Icon } from "../ui/Icon";

const iniciales = (nombre) => String(nombre || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

const copiar = async (texto) => {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success("ID copiado");
  } catch {
    toast.error("No se pudo copiar.");
  }
};

function Fila({ icono, etiqueta, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.border}`, minWidth: 0 }}>
      <Icon name={icono} size={16} color={T.textMut} />
      <span style={{ fontSize: 12, color: T.textMut, width: 96, flexShrink: 0 }}>{etiqueta}</span>
      <span style={{ fontSize: 13, color: T.text, minWidth: 0, overflowWrap: "anywhere", display: "flex", alignItems: "center", gap: 6 }}>{children}</span>
    </div>
  );
}

/** Perfil del usuario: datos de la cuenta, estado de la sesión y cambio de contraseña. */
export function PerfilDialogo({ user, etiquetaRol, iconoRol, duracionToken, conSegundoFactor, puedeCambiarPassword, onCambiarPassword, onCerrar }) {
  const instalacion = user.instalacion_asignada?.nombre;
  const dispositivo = user.dispositivo === "personal" ? "Personal" : user.dispositivo ? "Corporativo" : null;
  return (
    <Dialog.Root open onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="responsive-modal-overlay dialogo-overlay" style={{
          position: "fixed", inset: 0, background: "rgba(14,23,20,0.88)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16,
        }}>
          <Dialog.Content className="responsive-modal dialogo-panel" aria-describedby={undefined} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, boxShadow: "0 16px 40px rgba(0,0,0,0.6)", outline: "none",
            borderRadius: T.radius, padding: 22, width: "100%", maxWidth: 420, maxHeight: "90dvh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div aria-hidden="true" style={{
                width: 60, height: 60, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
                background: T.focusGhost, border: `2px solid ${T.focus}`, color: T.focusText, fontWeight: 700, fontSize: 22, fontFamily: FONT.ui,
              }}>{iniciales(user.nombre)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Dialog.Title style={{ margin: 0, fontWeight: 800, fontSize: 17, color: T.text, overflowWrap: "anywhere" }}>{user.nombre}</Dialog.Title>
                {user.email && <div style={{ fontSize: 12, color: T.textMut, marginTop: 2, overflowWrap: "anywhere" }}>{user.email}</div>}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "3px 9px", borderRadius: 999,
                  fontSize: 12, fontWeight: 600, color: T.focusText, background: T.focusGhost, border: `1px solid ${T.focus}`,
                }}><Icon name={iconoRol} size={13} color={T.focusText} />{etiquetaRol}</span>
              </div>
            </div>

            <div style={{ fontSize: 11, color: T.textMut, fontWeight: 500, margin: "18px 0 2px" }}>Cuenta</div>
            {user.empresa?.nombre && <Fila icono="building-2" etiqueta="Empresa">{user.empresa.nombre}</Fila>}
            {instalacion && <Fila icono="map-pin" etiqueta="Instalación">{instalacion}</Fila>}
            {dispositivo && <Fila icono="smartphone" etiqueta="Dispositivo">{dispositivo}</Fila>}
            <Fila icono="id-card" etiqueta="ID">
              <span style={{ fontFamily: FONT.mono, fontSize: 12 }}>{String(user.id).slice(0, 8)}…</span>
              <button type="button" className="gc-accion-btn" onClick={() => copiar(user.id)} aria-label="Copiar ID de usuario" title="Copiar ID completo" style={{
                background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "3px 6px", cursor: "pointer", display: "inline-flex",
              }}><Icon name="copy" size={13} color={T.textMut} /></button>
            </Fila>

            <div style={{ fontSize: 11, color: T.textMut, fontWeight: 500, margin: "18px 0 2px" }}>Seguridad</div>
            <Fila icono="clock" etiqueta="Sesión">Token JWT · <span style={{ fontFamily: FONT.mono }}>{duracionToken}</span></Fila>
            <Fila icono={conSegundoFactor ? "check" : "key-round"} etiqueta="Verificación">
              <span style={{ color: conSegundoFactor ? T.accent : T.text }}>{conSegundoFactor ? "2FA verificado" : "Autenticación estándar"}</span>
            </Fila>

            <div className="action-wrap modal-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20, flexWrap: "wrap" }}>
              <Btn variant="outline" onClick={onCerrar}>Cerrar</Btn>
              {puedeCambiarPassword && <Btn onClick={onCambiarPassword}><Icon name="key-round" size={16} /> Cambiar contraseña</Btn>}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
