import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { T } from "../../theme/theme";
import { KPI } from "../../components/ui/KPI";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3005/api/v1";
const SOCKET_URL = API_BASE.replace("/api/v1", "");

const ESTADO_COLOR = {
  presente: T.accent,
  tardio: T.yellow,
  faltante: T.red,
};

const ESTADO_LABEL = {
  presente: "Presente",
  tardio: "Tardío",
  faltante: "Faltante",
};

export function SupDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard/hoy`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Socket.IO
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("guardia:entrada", () => fetchData());
    socket.on("guardia:atraso", () => fetchData());

    return () => socket.disconnect();
  }, [token]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: T.textMut }}>⏳ Cargando dashboard...</div>;
  }

  if (!data) {
    return <div style={{ textAlign: "center", padding: 40, color: T.red }}>Error al cargar datos</div>;
  }

  return (
    <div>
      <SectionHeader title="Dashboard en Vivo" sub="Estado operacional en tiempo real" />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <KPI label="Total Turnos" value={data.total} sub="hoy" accent={T.textSec} />
        <KPI label="Presentes" value={data.presentes} sub="en turno" accent={T.accent} />
        <KPI label="Tardíos" value={data.tardios} sub="con retraso" accent={T.yellow} />
        <KPI label="Faltantes" value={data.faltantes} sub="sin marcar" accent={T.red} />
      </div>

      {/* Lista de guardias */}
      <div style={{ fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
        GGSS en Pauta Hoy
      </div>

      {data.lista.length === 0 ? (
        <div style={{
          background: T.bgCard, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: 20, textAlign: "center",
          fontSize: 13, color: T.textMut,
        }}>
          No hay turnos asignados para hoy
        </div>
      ) : data.lista.map((g, i) => (
        <div key={i} style={{
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderLeft: `3px solid ${ESTADO_COLOR[g.estado]}`,
          borderRadius: 12, padding: 12, marginBottom: 6,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{g.guardia}</div>
            <div style={{ fontSize: 11, color: T.textMut }}>{g.instalacion} · {g.hora_inicio}–{g.hora_fin}</div>
            {g.hora_entrada && (
              <div style={{ fontSize: 10, color: T.textMut, marginTop: 2 }}>
                Entrada: {new Date(g.hora_entrada).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
          <span style={{
            background: `${ESTADO_COLOR[g.estado]}18`,
            color: ESTADO_COLOR[g.estado],
            fontSize: 10, fontWeight: 700, padding: "3px 8px",
            borderRadius: 6, textTransform: "uppercase", letterSpacing: 0.8,
          }}>
            {ESTADO_LABEL[g.estado]}
          </span>
        </div>
      ))}

      <div style={{ fontSize: 10, color: T.textMut, textAlign: "center", marginTop: 12 }}>
        🔴 En vivo · Se actualiza automáticamente con Socket.IO
      </div>
    </div>
  );
}
