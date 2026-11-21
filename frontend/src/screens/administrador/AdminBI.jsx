import { useEffect, useMemo, useState } from "react";
import { FONT, T } from "../../theme/theme";
import { KPI } from "../../components/ui/KPI";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Btn } from "../../components/ui/Btn";
import { api } from "../../services/api";
import { formatearRut } from "../../utils/rut";
import { agruparPorInstalacion } from "../../utils/unirResumenMensual";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const URGENCIAS = [
  { clave: "rojo", etiqueta: "Críticas", color: T.red },
  { clave: "amarillo", etiqueta: "Medias", color: T.yellow },
  { clave: "verde", etiqueta: "Bajas", color: T.accent },
];

const TRIMESTRES = ["T1 (ene–mar)", "T2 (abr–jun)", "T3 (jul–sep)", "T4 (oct–dic)"];

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
  const [instSel, setInstSel] = useState(null); // instalación abierta en la ventana de guardias
  const [vista, setVista] = useState("mensual");
  const [trimestre, setTrimestre] = useState(Math.floor(hoy.getMonth() / 3) + 1);
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

  const trimestral = vista === "trimestral";
  const clave = `${vista}-${trimestral ? trimestre : mes}-${anio}`;
  const periodo = trimestral ? `${TRIMESTRES[trimestre - 1].slice(0, 2)} de ${anio}` : `${MESES[mes - 1]} de ${anio}`;

  useEffect(() => {
    let activo = true;
    const primerMes = trimestral ? (trimestre - 1) * 3 + 1 : mes;
    api.get(`/reportes/mensual/guardias?mes=${primerMes}&anio=${anio}&meses=${trimestral ? 3 : 1}`)
      .then((r) => { if (activo) { setMensual(Array.isArray(r) ? r : []); setError(""); } })
      .catch((err) => { if (activo) setError(err.message); })
      .finally(() => { if (activo) setCargadoPara(clave); });
    return () => { activo = false; };
  }, [clave, trimestral, trimestre, mes, anio]);

  const cargando = cargadoPara !== clave;
  const asistieron = (estado?.presentes ?? 0) + (estado?.tardios ?? 0);
  // Guardias que deberían estar trabajando: turnos ya iniciados, sin contar vacaciones ni ausencias aprobadas
  const iniciados = (estado?.totalTurnos ?? 0) - (estado?.porIniciar ?? 0) - (estado?.conAusencia ?? 0);
  const instalaciones = useMemo(() => agruparPorInstalacion(mensual), [mensual]);
  const instAbierta = instalaciones.find((i) => i.instalacion_id === instSel) ?? null;
  const guardiasInst = instAbierta ? mensual.filter((g) => g.instalacion_id === instSel) : [];

  useEffect(() => {
    if (instSel === null) return;
    const cerrar = (e) => { if (e.key === "Escape") setInstSel(null); };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [instSel]);
  const totales = useMemo(() => mensual.reduce((t, f) => ({
    turnos: t.turnos + f.turnos_programados, turnos_cubiertos: t.turnos_cubiertos + f.turnos_cubiertos,
    novedades: t.novedades + f.novedades, retraso: t.retraso + f.promedio_retraso_min * f.turnos_cubiertos,
  }), { turnos: 0, turnos_cubiertos: 0, novedades: 0, retraso: 0 }), [mensual]);
  const maxSemana = Math.max(1, ...semana.map((d) => d.total));
  const anios = [hoy.getFullYear(), hoy.getFullYear() - 1];

  return (
    <div>
      <SectionHeader title="Indicadores" />
      {error && <div style={{ ...card, color: T.red, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <h3 style={titulo}>Hoy</h3>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <KPI label="Turnos de hoy" value={estado?.totalTurnos ?? "—"} />
        <KPI label="Asistencia" value={estado && iniciados > 0 ? `${pct(asistieron, iniciados)}%` : "—"} sub={estado ? `${asistieron} de ${iniciados} guardias` : ""} accent={T.accent} />
        <KPI label="Puntualidad" value={estado && asistieron > 0 ? `${pct(estado.presentes, asistieron)}%` : "—"} sub={estado ? `${estado.tardios} llegaron tarde` : ""} accent={estado?.tardios ? T.yellow : T.accent} />
        <KPI label="Ausentes" value={estado?.ausentes ?? "—"} accent={estado?.ausentes ? T.red : undefined} />
        <KPI label="Por iniciar" value={estado?.porIniciar ?? "—"} />
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
        <h3 style={{ ...titulo, margin: 0 }}>{trimestral ? "Resumen trimestral" : "Resumen mensual"}</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <select aria-label="Vista" value={vista} onChange={(e) => setVista(e.target.value)} style={{ background: T.bgCard, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "6px 10px", fontSize: 12 }}>
            <option value="mensual">Mensual</option>
            <option value="trimestral">Trimestral</option>
          </select>
          {trimestral ? (
            <select aria-label="Trimestre" value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))} style={{ background: T.bgCard, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "6px 10px", fontSize: 12 }}>
              {TRIMESTRES.map((t, i) => <option key={t} value={i + 1}>{t}</option>)}
            </select>
          ) : (
            <select aria-label="Mes" value={mes} onChange={(e) => setMes(Number(e.target.value))} style={{ background: T.bgCard, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "6px 10px", fontSize: 12 }}>
              {MESES.map((m, i) => <option key={m} value={i + 1} style={{ textTransform: "capitalize" }}>{m}</option>)}
            </select>
          )}
          <select aria-label="Año" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ background: T.bgCard, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "6px 10px", fontSize: 12 }}>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <KPI label="Cobertura" value={`${pct(totales.turnos_cubiertos, totales.turnos)}%`} sub={`${totales.turnos_cubiertos} de ${totales.turnos} turnos`} accent={T.accent} />
        <KPI label="Retraso promedio" value={totales.turnos_cubiertos ? `${Math.round(totales.retraso / totales.turnos_cubiertos)} min` : "—"} />
        <KPI label="Novedades" value={totales.novedades} />
      </div>
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        {cargando ? <div style={{ padding: 16, fontSize: 12, color: T.textMut }}>Cargando…</div>
          : mensual.length === 0 ? <div style={{ padding: 16, fontSize: 12, color: T.textMut }}>No hay turnos programados en {periodo}.</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: T.text }}>
              <thead>
                <tr style={{ color: T.textSec, textAlign: "left" }}>
                  {["Instalación", "Guardias", "Cobertura", "Cubiertos / turnos", "Retraso prom.", "Horas prom.", "Novedades"].map((h) => <th key={h} style={{ padding: "10px 14px", fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {instalaciones.map((f) => (
                  <tr key={f.instalacion_id} role="button" tabIndex={0} onClick={() => setInstSel(f.instalacion_id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setInstSel(f.instalacion_id); } }}
                    style={{ cursor: "pointer" }}>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, fontWeight: 600 }}>{f.instalacion}</td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, fontFamily: FONT.mono }}>{f.guardias}</td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, minWidth: 140 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}><Barra valor={f.cobertura} max={100} color={f.cobertura >= 90 ? T.accent : f.cobertura >= 70 ? T.yellow : T.red} /></div>
                        <span style={{ fontFamily: FONT.mono, width: 38, textAlign: "right" }}>{f.cobertura}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, fontFamily: FONT.mono }}>{f.turnos_cubiertos}/{f.turnos_programados}</td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                      {f.turnos_cubiertos === 0 ? "—" : f.promedio_retraso_min > 0 ? <Badge color="yellow">{f.promedio_retraso_min} min</Badge> : <Badge color="accent">Puntual</Badge>}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, fontFamily: FONT.mono }}>{f.turnos_cubiertos === 0 ? "—" : `${f.promedio_horas} h`}</td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, fontFamily: FONT.mono }}>{f.novedades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
      {instAbierta && (
        <div role="dialog" aria-modal="true" aria-label={`Guardias de ${instAbierta.instalacion}`} onClick={() => setInstSel(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(14,23,20,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, width: "100%", maxWidth: 820, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 16px 40px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: T.focusText }}>{instAbierta.instalacion}</div>
                <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>
                  {trimestral ? TRIMESTRES[trimestre - 1] : MESES[mes - 1]} {anio} · {guardiasInst.length} guardia{guardiasInst.length !== 1 ? "s" : ""}
                </div>
              </div>
              <Btn variant="outline" onClick={() => setInstSel(null)} style={{ minHeight: 36, padding: "0 14px", fontSize: 13 }}>Cerrar</Btn>
            </div>
            <div style={{ overflow: "auto", padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 10 }}>
              {guardiasInst.map((g) => (
                <div key={g.usuario_id} style={{ background: T.bg, border: `1px solid ${T.border}`, borderLeft: `3px solid ${g.cobertura >= 90 ? T.accent : g.cobertura >= 70 ? T.yellow : T.red}`, borderRadius: T.radius, padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{g.guardia}</div>
                  {g.rut && <div style={{ fontSize: 11, color: T.textMut, fontFamily: FONT.mono, marginTop: 2 }}>{formatearRut(g.rut)}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                    <div style={{ flex: 1 }}><Barra valor={g.cobertura} max={100} color={g.cobertura >= 90 ? T.accent : g.cobertura >= 70 ? T.yellow : T.red} /></div>
                    <span style={{ fontFamily: FONT.mono, fontSize: 12, width: 38, textAlign: "right" }}>{g.cobertura}%</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px 12px", marginTop: 12 }}>
                    {[
                      ["Cubiertos / turnos", `${g.turnos_cubiertos}/${g.turnos_programados}`],
                      ["Retraso prom.", g.turnos_cubiertos === 0 ? "—" : g.promedio_retraso_min > 0 ? `${g.promedio_retraso_min} min` : "Puntual"],
                      ["Horas prom.", g.turnos_cubiertos === 0 ? "—" : `${g.promedio_horas} h`],
                      ["Novedades", g.novedades],
                    ].map(([etiqueta, valor]) => (
                      <div key={etiqueta}>
                        <div style={{ fontSize: 10, color: T.textMut }}>{etiqueta}</div>
                        <div style={{ fontSize: 14, fontFamily: FONT.mono, color: T.text, marginTop: 2 }}>{valor}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
