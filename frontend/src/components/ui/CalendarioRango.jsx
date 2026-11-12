import { useState } from "react";
import { T } from "../../theme/theme";
import { Icon } from "./Icon";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Fechas como "YYYY-MM-DD"; el cálculo va en UTC para evitar corrimientos por zona horaria.
const aFecha = (iso) => new Date(`${iso}T00:00:00Z`);
const aIso = (d) => d.toISOString().slice(0, 10);
export const sumarDias = (iso, dias) => { const d = aFecha(iso); d.setUTCDate(d.getUTCDate() + dias); return aIso(d); };
const hoyIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });

/**
 * Calendario mensual que pinta en morado suave el rango elegido.
 * Al hacer clic en un día define el inicio; el fin se calcula con `dias` (ej. 21 en vacaciones).
 */
export function CalendarioRango({ inicio, dias, onElegir }) {
  const hoy = hoyIso();
  const base = aFecha(inicio || hoy);
  const [vista, setVista] = useState({ a: base.getUTCFullYear(), m: base.getUTCMonth() });
  const fin = inicio ? sumarDias(inicio, Math.max(dias, 1) - 1) : null;

  const primero = new Date(Date.UTC(vista.a, vista.m, 1));
  const huecos = (primero.getUTCDay() + 6) % 7; // semana desde lunes
  const total = new Date(Date.UTC(vista.a, vista.m + 1, 0)).getUTCDate();
  const celdas = [...Array(huecos).fill(null), ...Array.from({ length: total }, (_, i) => aIso(new Date(Date.UTC(vista.a, vista.m, i + 1))))];
  const mover = (delta) => setVista(({ a, m }) => { const d = new Date(Date.UTC(a, m + delta, 1)); return { a: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  const flecha = { background: "none", border: "none", color: T.textSec, cursor: "pointer", padding: 6, display: "inline-flex" };
  return (
    <div style={{ background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, maxWidth: 340 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <button type="button" aria-label="Mes anterior" onClick={() => mover(-1)} style={flecha}><Icon name="arrow-left" size={16} /></button>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text, textTransform: "capitalize" }}>{MESES[vista.m]} {vista.a}</span>
        <button type="button" aria-label="Mes siguiente" onClick={() => mover(1)} style={{ ...flecha, transform: "scaleX(-1)" }}><Icon name="arrow-left" size={16} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {DIAS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, color: T.textMut, padding: "4px 0" }}>{d}</div>)}
        {celdas.map((iso, i) => {
          if (!iso) return <div key={`h${i}`} />;
          const pasado = iso < hoy;
          const extremo = iso === inicio || iso === fin;
          const dentro = inicio && iso >= inicio && iso <= fin;
          return (
            <button type="button" key={iso} disabled={pasado} onClick={() => onElegir(iso)}
              aria-pressed={extremo} aria-label={iso}
              style={{
                border: `1px solid ${extremo ? T.borderFocus : "transparent"}`, borderRadius: 6, padding: "8px 0",
                fontSize: 12, fontWeight: extremo ? 700 : 500, fontFamily: "var(--font-ui)",
                background: extremo ? T.focus : dentro ? T.focusGhost : "transparent",
                color: pasado ? T.textMut : extremo ? "#fff" : dentro ? T.focusText : T.text,
                opacity: pasado ? 0.4 : 1, cursor: pasado ? "not-allowed" : "pointer",
              }}>{Number(iso.slice(8))}</button>
          );
        })}
      </div>
    </div>
  );
}
