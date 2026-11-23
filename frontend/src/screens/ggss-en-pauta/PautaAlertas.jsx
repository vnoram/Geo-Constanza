import { useEffect, useState } from "react";
import { Aparecer } from "../../components/ui/Aparecer";
import "./PautaVisual.css";
import { Icon } from "../../components/ui/Icon";
import { Esqueleto } from "../../components/ui/Esqueleto";
import { T } from "../../theme/theme";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";

const ESTILO = {
  warning: { color: "yellow", ghost: "yellowGhost", icono: "triangle-alert" },
  ok: { color: "accent", ghost: "accentGhost", icono: "circle-check" },
  info: { color: "accent", ghost: "accentGhost", icono: "clock" },
  error: { color: "red", ghost: "redGhost", icono: "ban" },
};

function hace(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  if (min < 1440) return `Hace ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", timeZone: "America/Santiago" });
}

export function PautaAlertas() {
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    api.get("/alertas/mias")
      .then(({ data }) => { if (activo) setAlertas(data ?? []); })
      .catch((e) => { if (activo) setError(e.message || "No se pudieron cargar las alertas."); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  return (
    <Aparecer className="guard-screen pauta-visual">
      <SectionHeader title="Alertas" sub="Novedades de tu turno y de tus gestiones" />
      {cargando && <Esqueleto filas={3} alto={64} />}
      {error && <div style={{ padding: "8px 12px", borderRadius: 8, background: T.redGhost, color: T.red, fontSize: 13 }}>{error}</div>}
      {!cargando && !error && alertas.length === 0 && (
        <div style={{ textAlign: "center", color: T.textMut, padding: 32, fontSize: 14, background: T.bgCard, borderRadius: 8, border: `1px solid ${T.border}` }}>
          No tienes alertas por ahora.
        </div>
      )}
      {alertas.map((a) => {
        const e = ESTILO[a.nivel] || ESTILO.info;
        return (
          <div key={a.id} className="pauta-alerta" style={{ background: T[e.ghost], border: `1px solid ${T[e.color]}22`, borderLeft: `3px solid ${T[e.color]}`, borderRadius: T.radius, padding: 14, marginBottom: 8 }}>
            <div style={{ fontSize: 15, color: T[e.color], fontWeight: 600 }}><Icon name={e.icono} size={16} /> {a.titulo}</div>
            <div style={{ fontSize: 13, color: T.textSec, marginTop: 4 }}>{hace(a.fecha)} · {a.detalle}</div>
          </div>
        );
      })}
    </Aparecer>
  );
}
