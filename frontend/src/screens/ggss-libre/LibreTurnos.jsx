import { Icon } from "../../components/ui/Icon";
import { useEffect, useState } from "react";
import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";
import { cacheRead, cacheWrite, CACHE_KEYS } from "../../utils/cache";

// Convierte "19:00"/"07:00" en texto legible indicando si termina al día siguiente
function formatHorario(inicio, fin) {
  const nocturno = fin < inicio;
  return `${inicio} — ${fin}${nocturno ? " (+1)" : ""}`;
}

function TurnoRow({ turno }) {
  const fecha = new Date(turno.fecha);
  const fechaStr = fecha.toLocaleDateString("es-CL", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    timeZone: "UTC",
  });

  const estadoColor = {
    programado: "accent",
    completado: "accent",
    cancelado:  "red",
  }[turno.estado] || "yellow";

  const nocturno = turno.hora_fin < turno.hora_inicio;

  return (
    <div className="guard-list-row" style={{
      background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
      padding: "12px 16px", marginBottom: 6,
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    }}>
      <div className="guard-list-row__main" style={{ flex: 1 }}>
        <div className="guard-card-header" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{fechaStr}</span>
          {nocturno && (
            <span style={{ fontSize: 10, color: T.focusText, background: T.bgCard, borderRadius: 4, padding: "1px 5px" }}>
              <Icon name="moon" size={16} /> nocturno
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: T.textSec }}>
          {formatHorario(turno.hora_inicio, turno.hora_fin)}
        </div>
        {turno.instalacion?.nombre && (
          <div style={{ fontSize: 11, color: T.textMut, marginTop: 2 }}>
            <Icon name="map-pin" size={16} /> {turno.instalacion.nombre}
          </div>
        )}
      </div>
      <Badge color={estadoColor}>{turno.estado}</Badge>
    </div>
  );
}

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const hoyIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
const corto = (h) => h.slice(0, 5);
const VERDE_NEON = "#39FF88"; // verde neón para los íconos de día y noche

/** Vista mensual: cada día con turno se pinta (morado; sol = diurno, luna = nocturno). */
function PautaMensual({ turnos }) {
  const hoy = hoyIso();
  const porDia = new Map();
  for (const t of turnos) porDia.set(String(t.fecha).slice(0, 10), t);

  const inicial = turnos.find(t => String(t.fecha).slice(0, 10) >= hoy) ?? turnos[0];
  const base = (inicial ? String(inicial.fecha).slice(0, 10) : hoy);
  const [vista, setVista] = useState({ a: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
  const [elegido, setElegido] = useState(null);

  const primero = new Date(Date.UTC(vista.a, vista.m, 1));
  const huecos = (primero.getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(vista.a, vista.m + 1, 0)).getUTCDate();
  const celdas = [...Array(huecos).fill(null), ...Array.from({ length: total }, (_, i) => new Date(Date.UTC(vista.a, vista.m, i + 1)).toISOString().slice(0, 10))];
  const mover = (d) => setVista(({ a, m }) => { const f = new Date(Date.UTC(a, m + d, 1)); return { a: f.getUTCFullYear(), m: f.getUTCMonth() }; });
  const delMes = turnos.filter(t => { const f = String(t.fecha).slice(0, 7); return f === `${vista.a}-${String(vista.m + 1).padStart(2, "0")}`; });
  const seleccionado = elegido ? porDia.get(elegido) : null;

  const flecha = { background: "none", border: `1px solid ${T.border}`, borderRadius: 6, color: T.textSec, cursor: "pointer", padding: "6px 10px", display: "inline-flex" };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
        <button type="button" aria-label="Mes anterior" onClick={() => mover(-1)} style={flecha} className="gc-accion-btn gc-accion-btn--morado"><Icon name="arrow-left" size={16} /></button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, textTransform: "capitalize" }}>{MESES[vista.m]} {vista.a}</div>
          <div style={{ fontSize: 11, color: T.textMut }}>{delMes.length} {delMes.length === 1 ? "turno" : "turnos"} este mes</div>
        </div>
        <button type="button" aria-label="Mes siguiente" onClick={() => mover(1)} style={{ ...flecha, transform: "scaleX(-1)" }} className="gc-accion-btn gc-accion-btn--morado"><Icon name="arrow-left" size={16} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
        {DIAS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, color: T.textMut, padding: "4px 0" }}>{d}</div>)}
        {celdas.map((iso, i) => {
          if (!iso) return <div key={`h${i}`} />;
          const t = porDia.get(iso);
          const nocturno = t && t.hora_fin < t.hora_inicio;
          const esHoy = iso === hoy;
          const activo = elegido === iso;

          return (
            <button type="button" key={iso} disabled={!t} onClick={() => setElegido(activo ? null : iso)} aria-pressed={activo}
              aria-label={t ? `${iso}: turno ${corto(t.hora_inicio)} a ${corto(t.hora_fin)}` : iso}
              className={t ? "gc-accion-btn gc-accion-btn--morado" : undefined}
              style={{
                minHeight: 86, borderRadius: 8, padding: "6px 4px", textAlign: "center", fontFamily: "var(--font-ui)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
                background: t ? (activo ? "rgba(122,78,191,0.34)" : "rgba(122,78,191,0.22)") : esHoy ? "rgba(232,106,42,0.10)" : T.bgCard,
                border: `${esHoy ? 2 : 1}px solid ${esHoy ? "rgba(238,154,107,0.75)" : activo ? T.focusText : t ? `${T.focus}aa` : T.border}`,
                color: t ? T.focusText : T.textMut,
                cursor: t ? "pointer" : "default", opacity: t ? 1 : 0.7,
              }}>
              <span style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0 4px" }}>
                <span style={{ fontSize: 14, fontWeight: esHoy || t ? 700 : 500, color: esHoy ? "#EE9A6B" : t ? undefined : T.textMut }}>{Number(iso.slice(8))}</span>
                {t && <Icon name={nocturno ? "moon" : "sun"} size={20} color={VERDE_NEON} />}
              </span>
              {t ? (
                <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.2 }}>
                  {corto(t.hora_inicio)}–{corto(t.hora_fin)}
                </span>
              ) : <span />}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "12px 0", fontSize: 11, color: T.textMut }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="sun" size={16} color={VERDE_NEON} />Turno diurno</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="moon" size={16} color={VERDE_NEON} />Turno nocturno</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "rgba(232,106,42,0.10)", border: "2px solid rgba(238,154,107,0.75)" }} />Hoy</span>
      </div>

      {seleccionado && <TurnoRow turno={seleccionado} />}
    </div>
  );
}

export function LibreTurnos() {
  // Semilla desde caché — turnos visibles de inmediato en F5
  const [turnos,   setTurnos]   = useState(() => cacheRead(CACHE_KEYS.ggsssTurnos) ?? []);
  const [cargando, setCargando] = useState(() => cacheRead(CACHE_KEYS.ggsssTurnos) === null);
  const [error,    setError]    = useState("");

  useEffect(() => {
    const cargar = async () => {
      // Solo activar el spinner si no hay datos previos
      if (turnos.length === 0) setCargando(true);
      setError("");
      try {
        const data = await api.get("/turnos");
        const lista = Array.isArray(data) ? data : (data.data ?? []);
        const vigentes = lista
          .filter((t) => t.estado !== "cancelado")
          .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        setTurnos(vigentes);
        cacheWrite(CACHE_KEYS.ggsssTurnos, vigentes);
      } catch {
        // Si hay datos cacheados, el error es silencioso; si no, lo mostramos
        if (turnos.length === 0) setError("No se pudieron cargar los turnos. Intenta de nuevo.");
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="guard-screen">
      <SectionHeader
        title="Mi pauta"
        sub="Toca un día con turno para ver el detalle"
      />

      {cargando && (
        <div style={{ textAlign: "center", padding: 40, fontSize: 13, color: T.textMut }}>
          Cargando turnos...
        </div>
      )}

      {!cargando && error && (
        <div style={{
          background: T.redGhost, border: `1px solid ${T.red}`,
          borderRadius: 8, padding: "10px 14px", fontSize: 13, color: T.red, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {!cargando && !error && turnos.length === 0 && (
        <div style={{ textAlign: "center", padding: 50 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}><Icon name="calendar-days" size={36} /></div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>
            Sin turnos asignados
          </div>
          <div style={{ fontSize: 12, color: T.textMut }}>
            Tu supervisor aún no ha generado una pauta para ti.
          </div>
        </div>
      )}

      {!cargando && !error && turnos.length > 0 && <PautaMensual turnos={turnos} />}
    </div>
  );
}
