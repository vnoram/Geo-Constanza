import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { T } from "../../theme/theme";
import { Btn } from "./Btn";

/**
 * Diálogo estándar de la app (reemplaza window.confirm / prompt / alert).
 *  - confirmar: título + mensaje + Cancelar / confirmar
 *  - motivo:    igual, con cuadro de texto obligatorio (`pedirMotivo`)
 *  - `variante`: "aprobar" (verde) o "rechazar" (naranja) para colorear el botón de confirmar
 *  - mensaje:   solo informa (`soloMensaje`), un único botón «Entendido»
 * `onConfirmar(motivo)` puede ser async; si lanza un error, se muestra dentro del diálogo.
 * El foco, Escape y el retorno del foco los resuelve Radix; el diálogo no se cierra mientras se procesa.
 */
export function Dialogo({ titulo, mensaje, confirmarLabel = "Confirmar", pedirMotivo = false, soloMensaje = false, variante = "primary", onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const confirmar = async () => {
    if (pedirMotivo && !motivo.trim()) { setError("Escribe el motivo."); return; }
    setError(""); setOcupado(true);
    try { await onConfirmar?.(motivo.trim()); }
    catch (err) { setError(err?.message || "No se pudo completar la acción."); setOcupado(false); }
  };

  return (
    <Dialog.Root open onOpenChange={(abierto) => { if (!abierto && !ocupado) onCancelar?.(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="responsive-modal-overlay dialogo-overlay" style={{
          position: "fixed", inset: 0, background: "rgba(14,23,20,0.88)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16,
        }}>
          <Dialog.Content
            className="responsive-modal dialogo-panel"
            {...(mensaje ? {} : { "aria-describedby": undefined })}
            onInteractOutside={(e) => e.preventDefault()}
            style={{
              background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 22,
              width: "100%", maxWidth: 400, boxShadow: "0 16px 40px rgba(0,0,0,0.6)", outline: "none",
            }}>
            <Dialog.Title style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 16, color: T.focusText }}>{titulo}</Dialog.Title>
            {mensaje && <Dialog.Description style={{ margin: "0 0 14px", fontSize: 13, color: T.textSec, lineHeight: 1.45 }}>{mensaje}</Dialog.Description>}
            {pedirMotivo && (
              <textarea aria-label="Motivo (obligatorio)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={3}
                placeholder="Motivo (obligatorio)" style={{
                  width: "100%", boxSizing: "border-box", background: T.bgInput, color: T.text, border: `1px solid ${T.border}`,
                  borderRadius: T.radius, padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-ui)", resize: "vertical", marginBottom: 12,
                }} />
            )}
            {error && <div role="alert" style={{ fontSize: 12, color: T.alert, marginBottom: 12 }}>{error}</div>}
            <div className="action-wrap modal-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              {soloMensaje
                ? <Btn onClick={onCancelar}>Entendido</Btn>
                : <>
                    <Btn variant="outline" onClick={onCancelar} disabled={ocupado}>Cancelar</Btn>
                    <Btn variant={variante} onClick={confirmar} loading={ocupado}>{confirmarLabel}</Btn>
                  </>}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
