import { useEffect, useMemo, useState } from "react";
import { FONT, T } from "../../theme/theme";
import { api } from "../../services/api";
import { unir } from "../../utils/unirResumenMensual";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const TRIMESTRES = ["T1 (ene–mar)", "T2 (abr–jun)", "T3 (jul–sep)", "T4 (oct–dic)"];
const card = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "12px 14px", marginBottom: 20 };
const etiqueta = { fontSize: 11, color: T.textMut, marginBottom: 2 };
const valor = { fontSize: 20, fontWeight: 700, fontFamily: FONT.mono, color: T.text, lineHeight: 1.1 };
const selector = { background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "4px 8px", fontSize: 12 };

/** Indicadores compactos del dashboard: período (mes o trimestre), novedades de 7 días y cobertura por instalación. */
export function IndicadoresCompactos() {
  const hoy = new Date();
  const [vista, setVista] = useState("mensual");
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [trimestre, setTrimestre] = useState(Math.floor(hoy.getMonth() / 3) + 1);
  const [semana, setSemana] = useState([]);
  const [filas, setFilas] = useState([]);
  const anio = hoy.getFullYear();
  const trimestral = vista === "trimestral";

  useEffect(() => {
    api.get("/reportes/semana").then((s) => setSemana(Array.isArray(s) ? s : [])).catch(() => {});
  }, []);

  useEffect(() => {
    let activo = true;
    const meses = trimestral ? [1, 2, 3].map((i) => (trimestre - 1) * 3 + i) : [mes];
    Promise.all(meses.map((m) => api.get(`/reportes/mensual?mes=${m}&anio=${anio}`)))
      .then((r) => { if (activo) setFilas(unir(r)); })
      .catch(() => { /* el dashboard sigue sin esta sección */ });
    return () => { activo = false; };
  }, [trimestral, trimestre, mes, anio]);

  const t = useMemo(() => filas.reduce((a, f) => ({
    turnos: a.turnos + f.turnos_programados, turnos_cubiertos: a.turnos_cubiertos + f.turnos_cubiertos,
    novedades: a.novedades + f.novedades, retraso: a.retraso + f.promedio_retraso_min * f.turnos_cubiertos,
  }), { turnos: 0, turnos_cubiertos: 0, novedades: 0, retraso: 0 }), [filas]);

  const cobertura = t.turnos > 0 ? Math.min(100, Math.round((t.turnos_cubiertos / t.turnos) * 100)) : 0;
  const retraso = t.turnos_cubiertos > 0 ? `${Math.round(t.retraso / t.turnos_cubiertos)} min` : "—";
  const max = Math.max(1, ...semana.map((d) => d.total));

  return (
    <div style={card}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 28px" }}>
        <div><div style={etiqueta}>Cobertura</div><div style={{ ...valor, color: T.accent }}>{cobertura}%</div></div>
        <div><div style={etiqueta}>Retraso prom.</div><div style={valor}>{retraso}</div></div>
        <div><div style={etiqueta}>Novedades</div><div style={valor}>{t.novedades}</div></div>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <select aria-label="Vista" value={vista} onChange={(e) => setVista(e.target.value)} style={selector}>
            <option value="mensual">Mensual</option>
            <option value="trimestral">Trimestral</option>
          </select>
          {trimestral ? (
            <select aria-label="Trimestre" value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))} style={selector}>
              {TRIMESTRES.map((x, i) => <option key={x} value={i + 1}>{x}</option>)}
            </select>
          ) : (
            <select aria-label="Mes" value={mes} onChange={(e) => setMes(Number(e.target.value))} style={{ ...selector, textTransform: "capitalize" }}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          )}
        </div>
      </div>

      {semana.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={etiqueta}>Novedades, últimos 7 días</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 64 }}>
            {semana.map((d) => (
              <div key={d.fecha} title={`${d.label}: ${d.total}`} style={{ flex: 1, maxWidth: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 3 }}>
                <span style={{ fontSize: 10, fontFamily: FONT.mono, color: T.textSec }}>{d.total}</span>
                <div style={{ width: "100%", height: `${Math.max(4, (d.total / max) * 70)}%`, background: d.total > 0 ? T.yellow : T.border, borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: T.textMut, textTransform: "capitalize" }}>{d.label.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {filas.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={etiqueta}>Cobertura por instalación</div>
          {filas.map((f) => (
            <div key={f.instalacion_id} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 1.2fr) 2fr 42px", gap: 10, alignItems: "center", fontSize: 12, color: T.text, marginTop: 6 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.instalacion}</span>
              <div style={{ background: T.bg, borderRadius: 4, height: 6, overflow: "hidden" }}>
                <div style={{ width: `${f.cobertura}%`, height: "100%", background: f.cobertura >= 90 ? T.accent : f.cobertura >= 70 ? T.yellow : T.red }} />
              </div>
              <span style={{ fontFamily: FONT.mono, textAlign: "right" }}>{f.cobertura}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
