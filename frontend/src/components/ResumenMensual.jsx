import { useEffect, useState } from "react";
import { T, FONT } from "../theme/theme";
import { Icon } from "./ui/Icon";
import { SubHeader } from "./ui/SubHeader";
import { api } from "../services/api";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const th = { padding: "8px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.textSec, textAlign: "right", whiteSpace: "nowrap" };
const td = { padding: "9px 10px", fontSize: 12, textAlign: "right", fontFamily: FONT.mono, fontVariantNumeric: "tabular-nums", color: T.text, whiteSpace: "nowrap" };

const colorCobertura = (c) => (c >= 90 ? T.accent : c >= 70 ? T.yellow : T.red);

// Resumen mensual por instalación (GET /reportes/mensual): turnos, asistencias,
// cobertura, retraso y horas promedio, y novedades del mes seleccionado.
export function ResumenMensual() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    api.get(`/reportes/mensual?mes=${mes}&anio=${anio}`)
      .then((r) => { if (vigente) setFilas(Array.isArray(r) ? r : []); })
      .catch((e) => { if (vigente) { setFilas([]); setError(e.message || "No se pudo cargar el resumen."); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [mes, anio]);

  const esMesActual = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear();
  const mover = (delta) => {
    let m = mes + delta;
    let a = anio;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    setCargando(true);
    setError("");
    setMes(m);
    setAnio(a);
  };

  const totTurnos = filas.reduce((s, f) => s + f.turnos_programados, 0);
  const totAsist = filas.reduce((s, f) => s + f.asistencias, 0);
  const totNov = filas.reduce((s, f) => s + f.novedades, 0);
  const prom = (campo) => (totAsist > 0 ? filas.reduce((s, f) => s + f[campo] * f.asistencias, 0) / totAsist : 0);
  const totCobertura = totTurnos > 0 ? Math.min(100, Math.round((totAsist / totTurnos) * 100)) : 0;

  const navBtn = {
    background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text,
    width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <SubHeader title="Resumen mensual por instalación" />
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
          <button type="button" aria-label="Mes anterior" onClick={() => mover(-1)} style={navBtn}>
            <Icon name="arrow-left" size={16} />
          </button>
          <div style={{ fontWeight: 700, fontSize: 14, textTransform: "capitalize", minWidth: 130, textAlign: "center" }}>
            {MESES[mes - 1]} {anio}
          </div>
          <button type="button" aria-label="Mes siguiente" onClick={() => mover(1)} disabled={esMesActual}
            style={{ ...navBtn, opacity: esMesActual ? 0.4 : 1, cursor: esMesActual ? "not-allowed" : "pointer" }}>
            <Icon name="chevron-right" size={16} />
          </button>
        </div>

        {cargando ? (
          <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 24 }}>Cargando resumen...</div>
        ) : error ? (
          <div style={{ fontSize: 12, color: T.red, textAlign: "center", padding: 24 }}>{error}</div>
        ) : filas.length === 0 ? (
          <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 24 }}>Sin turnos ni asistencias registrados en este mes.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  <th style={{ ...th, textAlign: "left" }}>Instalación</th>
                  <th style={th}>Turnos</th>
                  <th style={th}>Asistencias</th>
                  <th style={th}>Cobertura</th>
                  <th style={th}>Retraso prom.</th>
                  <th style={th}>Horas prom.</th>
                  <th style={th}>Novedades</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.instalacion_id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ ...td, textAlign: "left", fontFamily: "var(--font-ui)", fontWeight: 600, whiteSpace: "normal" }}>{f.instalacion}</td>
                    <td style={td}>{f.turnos_programados}</td>
                    <td style={td}>{f.asistencias}</td>
                    <td style={{ ...td, color: colorCobertura(f.cobertura), fontWeight: 700 }}>{f.cobertura}%</td>
                    <td style={td}>{f.promedio_retraso_min} min</td>
                    <td style={td}>{f.promedio_horas} h</td>
                    <td style={{ ...td, color: f.novedades > 0 ? T.yellow : T.textMut }}>{f.novedades}</td>
                  </tr>
                ))}
                <tr style={{ background: T.bgInput }}>
                  <td style={{ ...td, textAlign: "left", fontFamily: "var(--font-ui)", fontWeight: 800 }}>Total</td>
                  <td style={{ ...td, fontWeight: 800 }}>{totTurnos}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{totAsist}</td>
                  <td style={{ ...td, fontWeight: 800, color: colorCobertura(totCobertura) }}>{totCobertura}%</td>
                  <td style={{ ...td, fontWeight: 800 }}>{Math.round(prom("promedio_retraso_min"))} min</td>
                  <td style={{ ...td, fontWeight: 800 }}>{prom("promedio_horas").toFixed(1)} h</td>
                  <td style={{ ...td, fontWeight: 800 }}>{totNov}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, color: T.textMut, marginTop: 6 }}>
        Cobertura = asistencias / turnos programados. Novedades: solo incidencias (se excluyen rutinas).
      </div>
    </div>
  );
}
