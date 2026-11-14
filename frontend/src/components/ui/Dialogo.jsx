import { useLayoutEffect, useRef, useState } from "react";
import { T } from "../../theme/theme";
import { Btn } from "./Btn";

/**
 * Diálogo estándar de la app (reemplaza window.confirm / prompt / alert).
 *  - confirmar: título + mensaje + Cancelar / confirmar
 *  - motivo:    igual, con cuadro de texto obligatorio (`pedirMotivo`)
 *  - `variante`: "aprobar" (verde) o "rechazar" (naranja) para colorear el botón de confirmar
 *  - mensaje:   solo informa (`soloMensaje`), un único botón «Entendido»
 * `onConfirmar(motivo)` puede ser async; si lanza un error, se muestra dentro del diálogo.
 */
export function Dialogo({ titulo, mensaje, confirmarLabel = "Confirmar", pedirMotivo = false, soloMensaje = false, variante = "primary", onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const panel = useRef(null);
  const focoAnterior = useRef(null);

  useLayoutEffect(() => {
    const elemento = focoAnterior.current;
    return () => {
      if (elemento?.isConnected) elemento.focus({ preventScroll: true });
    };
  }, []);

  useLayoutEffect(() => {
    const elemento = panel.current;
    if (!elemento.contains(document.activeElement) || document.activeElement.matches(":disabled")) {
      (elemento.querySelector("textarea, button:not(:disabled)") ?? elemento).focus({ preventScroll: true });
    }
  }, [ocupado]);

  const mantenerFoco = (evento) => {
    if (evento.key !== "Tab") return;
    const controles = panel.current.querySelectorAll("textarea, button:not(:disabled)");
    const destino = evento.shiftKey ? controles[controles.length - 1] : controles[0];
    const extremo = evento.shiftKey ? controles[0] : controles[controles.length - 1];
    if (document.activeElement === extremo || document.activeElement === panel.current) {
      evento.preventDefault();
      (destino ?? panel.current).focus();
    }
  };

  const confirmar = async () => {
    if (pedirMotivo && !motivo.trim()) { setError("Escribe el motivo."); return; }
    setError(""); setOcupado(true);
    try { await onConfirmar?.(motivo.trim()); }
    catch (err) { setError(err?.message || "No se pudo completar la acción."); setOcupado(false); }
  };

  return (
    <div className="responsive-modal-overlay" role="dialog" aria-modal="true" aria-label={titulo} style={{
      position: "fixed", inset: 0, background: "rgba(14,23,20,0.88)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16,
    }}>
      <div ref={elemento => {
        panel.current = elemento;
        if (elemento && !focoAnterior.current) focoAnterior.current = document.activeElement;
      }} tabIndex={-1} onKeyDown={mantenerFoco} className="responsive-modal" style={{
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 22,
        width: "100%", maxWidth: 400, boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
      }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: T.focusText, marginBottom: 8 }}>{titulo}</div>
        {mensaje && <div style={{ fontSize: 13, color: T.textSec, marginBottom: 14, lineHeight: 1.45 }}>{mensaje}</div>}
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
      </div>
    </div>
  );
}
