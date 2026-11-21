import { useEffect, useMemo, useState } from "react";
import { FONT, T } from "../../theme/theme";
import { KPI } from "../../components/ui/KPI";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const URGENCIAS = [
  { clave: "rojo", etiqueta: "Críticas", color: T.red },
  { clave: "amarillo", etiqueta: "Medias", color: T.yellow },
  { clave: "verde", etiqueta: "Bajas", color: T.accent },
];

const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);
const card = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 16 };
const titulo = { margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: T.textSec, fontFamily: FONT.ui };

/** Barra horizontal simple: el ancho es la proporción respecto al máximo. */
function Barra({ valor, max, color }) {
  return (
    <div style={{ background: T.bg, borderRadius: 4, height: 8, overflow: "hidden" }}>
      <div style={{ width: `${max > 0 ? Math.round((valor / max) * 100) : 0}%`, height: "100%", background: color }} />
    </div>
  );
}

export function AdminBI() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [estado, setEstado] = useState(null);
  const [semana, setSemana] = useState([]);
  const [mensual, setMensual] = useState([]);
  const [error, setError] = useState("");
  const [cargadoPara, setCargadoPara] = useState(""); // período cuyos datos ya llegaron

  // Indicadores de hoy y de la semana: se refrescan solos cada minuto.
  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const [e, s] = await Promise.all([api.get("/reportes/estado"), api.get("/reportes/semana")]);
        if (activo) { setEstado(e); setSemana(Array.isArray(s) ? s : []); setError(""); }
      } catch (err) { if (activo) setError(err.message); }
    };
    cargar();
    const id = setInterval(cargar, 60000);
    return () => { activo = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    let activo = true;
    api.get(`/reportes/mensual?mes=${mes}&anio=${anio}`)
      .then((r) => { if (activo) { setMensual(Array.isArray(r) ? r : []); setError(""); } })
      .catch((err) => { if (activo) setError(err.message); })
      .finally(() => { if (activo) setCargadoPara(`${mes}-${anio}`); });
    return () => { activo = false; };
  }, [mes, anio]);

  const cargando = cargadoPara !== `${mes}-${anio}`;
  const asistieron = (estado?.presentes ?? 0) + (estado?.tardios ?? 0);
  const totales = useMemo(() => mensual.reduce((t, f) => ({
    turnos: t.turnos + f.turnos_programados, asistencias: t.asistencias + f.asistencias,
    novedades: t.novedades + f.novedades, retraso: t.retraso + f.promedio_retraso_min * f.asistencias,
  }), { turnos: 0, asistencias: 0, novedades: 0, retraso: 0 }), [mensual]);
  const maxSemana = Math.max(1, ...semana.map((d) => d.total));
  const anios = [hoy.getFullYear(), hoy.getFullYear() - 1];

  return (
    <div>
      <SectionHeader title="Indicadores" sub="Cumplimiento, puntualidad y novedades de tu empresa" />
      {error && <div style={{ ...card, color: T.red, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <h3 style={titulo}>Hoy · se actualiza solo</h3>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <KPI label="Turnos de hoy" value={estado?.totalTurnos ?? "—"} />
        <KPI label="Asistencia" value={estado ? `${pct(asistieron, estado.totalTurnos)}%` : "—"} sub={estado ? `${asistieron} de ${estado.totalTurnos} guardias` : ""} accent={T.accent} />
        <KPI label="Puntualidad" value={estado ? `${pct(estado.presentes, asistieron)}%` : "—"} sub={estado ? `${estado.tardios} llegaron tarde` : ""} accent={estado?.tardios ? T.yellow : T.accent} />
        <KPI label="Ausentes" value={estado?.ausentes ?? "—"} accent={estado?.ausentes ? T.red : undefined} sub="sin entrada registrada" />
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <h3 style={titulo}>Novedades de los últimos 7 días</h3>
        {semana.length === 0 ? <div style={{ fontSize: 12, color: T.textMut }}>Sin datos.</div> : semana.map((d) => (
          <div key={d.fecha} style={{ display: "grid", gridTemplateColumns: "70px 1fr 28px", gap: 10, alignItems: "center", marginBottom: 8, fontSize: 12, color: T.textSec }}>
            <span style={{ textTransform: "capitalize" }}>{d.label}</span>
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: T.bg }}>
              {URGENCIAS.map((u) => d[u.clave] > 0 && <div key={u.clave} title={`${u.etiqueta}: ${d[u.clave]}`} style={{ width: `${(d[u.clave] / maxSemana) * 100}%`, background: u.color }} />)}
            </div>
            <span style={{ fontFamily: FONT.mono, textAlign: "right", color: T.text }}>{d.total}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11, color: T.textMut }}>
          {URGENCIAS.map((u) => <span key={u.clave}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: u.color, marginRight: 5 }} />{u.etiqueta}</span>)}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <h3 style={{ ...titulo, margin: 0 }}>Resumen mensual por instalación</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <select aria-label="Mes" value={mes} onChange={(e) => setMes(Number(e.target.value))} style={{ background: T.bgCard, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "6px 10px", fontSize: 12 }}>
            {MESES.map((m, i) => <option key={m} value={i + 1} style={{ textTransform: "capitalize" }}>{m}</option>)}
          </select>
          <select aria-label="Año" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ background: T.bgCard, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "6px 10px", fontSize: 12 }}>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <KPI label="Cobertura del mes" value={`${pct(totales.asistencias, totales.turnos)}%`} sub={`${totales.asistencias} de ${totales.turnos} turnos`} accent={T.accent} />
        <KPI label="Retraso promedio" value={`${totales.asistencias ? Math.round(totales.retraso / totales.asistencias) : 0} min`} />
        <KPI label="Novedades" value={totales.novedades} sub="incidencias del mes" />
      </div>
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        {cargando ? <div style={{ padding: 16, fontSize: 12, color: T.textMut }}>Cargando…</div>
          : mensual.length === 0 ? <div style={{ padding: 16, fontSize: 12, color: T.textMut }}>No hay turnos ni asistencias en {MESES[mes - 1]} de {anio}.</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: T.text }}>
              <thead>
                <tr style={{ color: T.textSec, textAlign: "left" }}>
                  {["Instalación", "Cobertura", "Turnos", "Retraso prom.", "Horas prom.", "Novedades"].map((h) => <th key={h} style={{ padding: "10px 14px", fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {mensual.map((f) => (
                  <tr key={f.instalacion_id}>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, fontWeight: 600 }}>{f.instalacion}</td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, minWidth: 140 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}><Barra valor={f.cobertura} max={100} color={f.cobertura >= 90 ? T.accent : f.cobertura >= 70 ? T.yellow : T.red} /></div>
                        <span style={{ fontFamily: FONT.mono, width: 38, textAlign: "right" }}>{f.cobertura}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, fontFamily: FONT.mono }}>{f.asistencias}/{f.turnos_programados}</td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                      {f.promedio_retraso_min > 0 ? <Badge color="yellow">{f.promedio_retraso_min} min</Badge> : <Badge color="accent">Puntual</Badge>}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, fontFamily: FONT.mono }}>{f.promedio_horas} h</td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, fontFamily: FONT.mono }}>{f.novedades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
