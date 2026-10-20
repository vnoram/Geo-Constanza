import { useState, useEffect, useCallback } from "react";
import { T, FONT } from "../../theme/theme";
import { KPI } from "../ui/KPI";
import { SectionHeader } from "../ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";
import { API_URL as API_BASE } from "../../config/api";

const PERIODOS = [7, 30, 90];

const PRIORIDAD_COLOR = { alta: T.alert, media: T.yellow, baja: T.textSec };
const PRIORIDAD_LABEL = { alta: "Alta", media: "Media", baja: "Baja" };

const fmt = (v, sufijo = "") => (v === null || v === undefined ? "—" : `${v}${sufijo}`);

const etiquetaDia = (iso) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const tituloSeccion = {
  fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 8,
};

const tarjeta = {
  background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius,
};

// ─── Gráfico: turnos sin cobertura por día ────────────────────────────────
// Una sola serie (color de estado "crítico" del tema). Con el cursor o al tocar
// una barra se ve el detalle del día; la vista de tabla muestra los mismos datos.
function TendenciaDescubiertos({ tendencia }) {
  const [activo, setActivo] = useState(null);
  const [tabla, setTabla] = useState(false);

  const W = 300, H = 90, PAD_B = 4;
  const max = Math.max(1, ...tendencia.map((d) => d.descubiertos));
  const paso = W / tendencia.length;
  const ancho = Math.max(2, Math.min(14, paso - 2));
  const sel = activo !== null ? tendencia[activo] : null;

  return (
    <div style={{ ...tarjeta, padding: 14, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Turnos sin cobertura por día</div>
        <button
          className="touch-target"
          onClick={() => setTabla((v) => !v)}
          style={{
            background: "none", border: `1px solid ${T.border}`, color: T.textSec,
            borderRadius: T.radius, padding: "0 10px", minHeight: 32, fontSize: 11, cursor: "pointer",
            fontFamily: FONT.ui,
          }}
        >
          {tabla ? "Ver gráfico" : "Ver tabla"}
        </button>
      </div>

      {tabla ? (
        <div style={{ maxHeight: 220, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: T.textSec }}>
            <thead>
              <tr style={{ color: T.textMut, textAlign: "right" }}>
                <th style={{ textAlign: "left", padding: "4px 0" }}>Día</th>
                <th>Turnos</th><th>Sin cobertura</th><th>Tardíos</th><th>Novedades</th>
              </tr>
            </thead>
            <tbody>
              {[...tendencia].reverse().map((d) => (
                <tr key={d.fecha} style={{ textAlign: "right", borderTop: `1px solid ${T.border}` }}>
                  <td style={{ textAlign: "left", padding: "4px 0" }}>{etiquetaDia(d.fecha)}</td>
                  <td>{d.evaluados}</td><td>{d.descubiertos}</td><td>{d.tardios}</td><td>{d.novedades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Turnos sin cobertura por día"
            style={{ width: "100%", height: 90, display: "block" }}
            onMouseLeave={() => setActivo(null)}
          >
            <line x1="0" x2={W} y1={H - PAD_B} y2={H - PAD_B} stroke={T.border} strokeWidth="1" />
            {tendencia.map((d, i) => {
              const h = d.descubiertos > 0 ? Math.max(3, (d.descubiertos / max) * (H - PAD_B - 8)) : 0;
              const x = i * paso + (paso - ancho) / 2;
              return (
                <g key={d.fecha} onMouseEnter={() => setActivo(i)} onClick={() => setActivo(i)}>
                  {/* área de contacto más grande que la barra */}
                  <rect x={i * paso} y="0" width={paso} height={H} fill="transparent" />
                  {h > 0 && (
                    <rect
                      x={x} y={H - PAD_B - h} width={ancho} height={h} rx="2"
                      fill={T.alert} opacity={activo === null || activo === i ? 1 : 0.45}
                    />
                  )}
                </g>
              );
            })}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.textMut, marginTop: 4 }}>
            <span>{etiquetaDia(tendencia[0].fecha)}</span>
            <span>{etiquetaDia(tendencia[tendencia.length - 1].fecha)}</span>
          </div>
          <div style={{ fontSize: 11, color: T.textSec, marginTop: 8, minHeight: 16 }}>
            {sel
              ? `${etiquetaDia(sel.fecha)}: ${sel.descubiertos} sin cobertura de ${sel.evaluados} turnos · ${sel.tardios} tardíos · ${sel.novedades} novedades`
              : "Pasa el cursor o toca una barra para ver el detalle del día."}
          </div>
        </>
      )}
    </div>
  );
}

function AlertaItem({ alerta }) {
  const color = PRIORIDAD_COLOR[alerta.prioridad];
  return (
    <details style={{ ...tarjeta, borderLeft: `3px solid ${color}`, padding: "10px 14px", marginBottom: 6 }}>
      <summary style={{ cursor: "pointer", listStyle: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{alerta.titulo}</div>
            <div style={{ fontSize: 11, color: T.textMut, marginTop: 2 }}>{alerta.detalle}</div>
          </div>
          <span style={{
            flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
            background: `${color}1F`, color,
          }}>
            {PRIORIDAD_LABEL[alerta.prioridad]}
          </span>
        </div>
      </summary>
      <div style={{ fontSize: 11, color: T.textSec, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
        <strong style={{ color: T.text }}>Por qué se generó:</strong> {alerta.porQue}
      </div>
    </details>
  );
}

export function InsightPanel() {
  const { token } = useAuth();
  const [dias, setDias] = useState(30);
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/dashboard/insight?dias=${dias}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error del servidor (HTTP ${res.status})`);
      setData(json);
    } catch (e) {
      setError(e.message || "No se pudo cargar el panel");
    } finally {
      setCargando(false);
    }
  }, [dias, token]);

  useEffect(() => { cargar(); }, [cargar]);

  const lb = data?.lineaBase;
  const sinDatos = lb && lb.turnosEvaluados === 0 && lb.novedades.total === 0;

  return (
    <div className="operations-screen">
      <SectionHeader
        title="Insight"
        sub="Línea base y alertas por reglas. No usa inteligencia artificial: cada alerta explica por qué se generó."
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {PERIODOS.map((p) => (
          <button
            key={p}
            className="touch-target"
            onClick={() => setDias(p)}
            style={{
              background: dias === p ? T.focusGhost : "none",
              border: `1px solid ${dias === p ? T.focus : T.border}`,
              color: dias === p ? T.focusText : T.textSec,
              borderRadius: T.radius, padding: "0 14px", minHeight: 36, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: FONT.ui,
            }}
          >
            {p} días
          </button>
        ))}
      </div>

      {cargando && !data && <div style={{ textAlign: "center", padding: 40, color: T.textMut }}>Cargando...</div>}
      {error && (
        <div style={{ ...tarjeta, padding: 14, color: T.alert, fontSize: 12, marginBottom: 16 }}>
          {error}{" "}
          <button onClick={cargar} style={{ background: "none", border: "none", color: T.focusText, cursor: "pointer", fontWeight: 600 }}>
            Reintentar
          </button>
        </div>
      )}

      {data && (
        <>
          {sinDatos && (
            <div style={{ ...tarjeta, padding: 14, fontSize: 12, color: T.textSec, marginBottom: 16 }}>
              Aún no hay turnos ni novedades en este período. La línea base se llena a medida que se usa el sistema.
            </div>
          )}

          {/* ── Alertas ── */}
          <div style={tituloSeccion}>
            Alertas activas ({data.totalAlertas}){data.totalAlertas > data.alertas.length ? ` · mostrando ${data.alertas.length}` : ""}
          </div>
          {data.alertas.length === 0 ? (
            <div style={{ ...tarjeta, padding: 14, fontSize: 12, color: T.textMut, marginBottom: 20 }}>
              Sin alertas por ahora. Las reglas se evalúan cada vez que abres este panel.
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              {data.alertas.map((a) => <AlertaItem key={a.id} alerta={a} />)}
            </div>
          )}

          {/* ── Línea base ── */}
          <div style={tituloSeccion}>Línea base · últimos {data.periodo.dias} días</div>
          <div className="metrics-grid" style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            <KPI label="Cobertura" value={fmt(lb.coberturaPct, "%")} sub={`${lb.turnosCubiertos} de ${lb.turnosEvaluados} turnos`} accent={T.accent} />
            <KPI label="Sin cobertura" value={lb.turnosDescubiertos} sub="turnos sin marcaje" accent={T.alert} />
            <KPI label="Tardíos" value={fmt(lb.tardiosPct, "%")} sub={`${lb.tardios} entradas con retraso`} accent={T.yellow} />
            <KPI label="Retraso medio" value={fmt(lb.retrasoPromedioMin, " min")} sub="entre quienes marcaron" accent={T.textSec} />
            <KPI label="Atención de novedades" value={fmt(lb.novedades.tiempoMedioAtencionMin, " min")} sub="tiempo medio" accent={T.textSec} />
            <KPI label="Novedades rojas" value={lb.novedades.rojas} sub={`de ${lb.novedades.total} en total`} accent={T.alert} />
          </div>

          {/* ── Tendencia ── */}
          {data.tendencia.length > 0 && <TendenciaDescubiertos tendencia={data.tendencia} />}

          {/* ── Instalaciones ── */}
          {data.porInstalacion.length > 0 && (
            <>
              <div style={tituloSeccion}>Instalaciones con más incidencias</div>
              <div style={{ marginBottom: 20 }}>
                {data.porInstalacion.map((i) => (
                  <div key={i.id} style={{ ...tarjeta, padding: "10px 14px", marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{i.nombre}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, fontFamily: FONT.mono, color: i.puntos > 0 ? T.yellow : T.textMut }}>{i.puntos} pts</div>
                    </div>
                    <div style={{ fontSize: 11, color: T.textMut, marginTop: 3 }}>
                      Cobertura {fmt(i.coberturaPct, "%")} · {i.descubiertos} sin cobertura · {i.tardios} tardíos · {i.novedadesRojas} rojas · {i.novedadesAmarillas} amarillas
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Cómo se calcula ── */}
          <details style={{ ...tarjeta, padding: "10px 14px", marginBottom: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.textSec }}>
              Cómo se calcula
            </summary>
            <div style={{ fontSize: 11, color: T.textSec, marginTop: 10, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 6 }}>
                Un turno cuenta como <strong>sin cobertura</strong> si pasaron {data.umbrales.SIN_MARCAJE_MIN} min desde su inicio sin
                marcaje, y como <strong>tardío</strong> si la entrada fue más de {data.umbrales.TARDIO_MIN} min después del inicio.
                Los puntos por instalación suman: sin cobertura ×3, tardío ×1, novedad roja ×5 y amarilla ×1.
              </div>
              <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
                {data.reglas.map((r) => <li key={r.id}>{r.descripcion}</li>)}
              </ul>
              <div style={{ color: T.textMut }}>
                Las alertas son apoyo a la decisión del supervisor. No sancionan ni reemplazan su criterio.
                Los umbrales son valores iniciales que se ajustarán con la operación real.
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
