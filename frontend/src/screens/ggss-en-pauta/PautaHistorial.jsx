import { useState, useEffect } from "react";
import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";

const TZ = "America/Santiago";

function formatFecha(d) {
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ })
    .replace(/\./g, "");
}

function formatHora(d) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
}

function formatHoras(h) {
  if (h == null) return "—";
  const min = Math.round(h * 60);
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

function resumen(a) {
  if (!a.hora_salida) return { texto: "En curso", color: "yellow" };
  if (a.estado === "tardio") return { texto: "Tardío", color: "red" };
  return { texto: "Normal", color: "accent" };
}

export function PautaHistorial({ user }) {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelado = false;
    api.get(`/asistencia/historial/${user.id}?limit=30`)
      .then(res => { if (!cancelado) setRegistros(res.data ?? []); })
      .catch(err => { if (!cancelado) setError(err.message || "No se pudo cargar el historial."); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [user?.id]);

  return (
    <div className="guard-screen">
      <SectionHeader title="Historial" sub="Tu registro de asistencia" />

      {loading && (
        <div style={{ textAlign: "center", color: T.textMut, padding: 32, fontSize: 14 }}>
          Cargando historial...
        </div>
      )}

      {error && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: T.redGhost, color: T.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loading && !error && registros.length === 0 && (
        <div style={{
          textAlign: "center", color: T.textMut, padding: 32, fontSize: 14,
          background: T.bgCard, borderRadius: 8, border: `1px solid ${T.border}`,
        }}>
          Aún no tienes asistencias registradas.
        </div>
      )}

      {registros.map(a => {
        const est = resumen(a);
        return (
          <div className="guard-list-row" key={a.id} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: 14, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div className="guard-list-row__main">
              <div style={{ fontWeight: 700, fontSize: 14 }}>{formatFecha(a.hora_entrada)}</div>
              <div style={{ fontSize: 11, color: T.textMut }}>
                {formatHora(a.hora_entrada)} → {formatHora(a.hora_salida)}
                {a.instalacion?.nombre ? ` · ${a.instalacion.nombre}` : ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <Badge color={est.color}>{est.texto}</Badge>
              <div style={{ fontSize: 10, color: T.textMut, marginTop: 4 }}>
                {a.hora_salida ? formatHoras(a.horas_trabajadas) : "—"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
