import { useEffect, useMemo, useState } from "react";
import { FONT, T } from "../../theme/theme";
import { api } from "../../services/api";
import { GraficoCobertura, GraficoNovedades } from "../../components/ui/Graficos";
import { unir } from "../../utils/unirResumenMensual";
import { Selector } from "../../components/ui/Selector";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const TRIMESTRES = ["T1 (ene–mar)", "T2 (abr–jun)", "T3 (jul–sep)", "T4 (oct–dic)"];
const card = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "12px 14px", marginBottom: 20 };
const etiqueta = { fontSize: 11, color: T.textMut, marginBottom: 2 };
const valor = { fontSize: 20, fontWeight: 700, fontFamily: FONT.mono, color: T.text, lineHeight: 1.1 };

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

  return (
    <div style={card}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 28px" }}>
        <div><div style={etiqueta}>Cobertura</div><div style={{ ...valor, color: T.accent }}>{cobertura}%</div></div>
        <div><div style={etiqueta}>Retraso prom.</div><div style={valor}>{retraso}</div></div>
        <div><div style={etiqueta}>Novedades</div><div style={valor}>{t.novedades}</div></div>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <Selector etiqueta="Vista" value={vista} onChange={setVista} opciones={[{ valor: "mensual", etiqueta: "Mensual" }, { valor: "trimestral", etiqueta: "Trimestral" }]} />
          {trimestral
            ? <Selector etiqueta="Trimestre" value={trimestre} onChange={setTrimestre} opciones={TRIMESTRES.map((x, i) => ({ valor: i + 1, etiqueta: x }))} />
            : <Selector etiqueta="Mes" value={mes} onChange={setMes} capitalizar opciones={MESES.map((m, i) => ({ valor: i + 1, etiqueta: m }))} />}
        </div>
      </div>

      {semana.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={etiqueta}>Novedades, últimos 7 días</div>
          <GraficoNovedades semana={semana} alto={130} />
        </div>
      )}

      {filas.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={etiqueta}>Cobertura por instalación</div>
          <GraficoCobertura filas={filas} />
        </div>
      )}
    </div>
  );
}
