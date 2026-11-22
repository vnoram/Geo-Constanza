import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { T, FONT } from "../../theme/theme";

/** Anima el primer número de un valor (por ejemplo "85%" o 12) cuando cambia; el resto del texto queda igual. */
function ValorAnimado({ valor }) {
  const nodo = useRef(null);
  const anterior = useRef(null);
  const sinMovimiento = useReducedMotion();
  const texto = String(valor ?? "");
  const partes = texto.match(/^(\D*)(\d+(?:[.,]\d+)?)(.*)$/);

  useEffect(() => {
    if (!partes || !nodo.current) return undefined;
    const destino = Number(partes[2].replace(",", "."));
    const decimales = (partes[2].split(/[.,]/)[1] ?? "").length;
    const origen = anterior.current ?? 0;
    anterior.current = destino;
    if (sinMovimiento || origen === destino) { nodo.current.textContent = partes[2]; return undefined; }
    const control = animate(origen, destino, {
      duration: 0.6, ease: "easeOut",
      onUpdate: (v) => { if (nodo.current) nodo.current.textContent = v.toFixed(decimales).replace(".", partes[2].includes(",") ? "," : "."); },
    });
    return () => control.stop();
  }, [texto, sinMovimiento]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!partes) return texto;
  return <>{partes[1]}<span ref={nodo}>{partes[2]}</span>{partes[3]}</>;
}

export function KPI({ label, value, sub, accent }) {
  return (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: T.radius, padding: "12px 14px", flex: 1, minWidth: 100,
    }}>
      <div style={{ fontSize: 12, color: T.textSec, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: accent || T.text, lineHeight: 1, fontFamily: FONT.mono, fontVariantNumeric: "tabular-nums" }}>
        <ValorAnimado valor={value} />
      </div>
      {sub && <div style={{ fontSize: 11, color: T.textMut, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
