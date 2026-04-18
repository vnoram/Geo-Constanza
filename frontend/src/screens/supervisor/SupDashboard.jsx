import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { T } from "../../theme/theme";
import { KPI } from "../../components/ui/KPI";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";
import { cacheRead, cacheWrite, CACHE_KEYS } from "../../utils/cache";

const API_BASE   = import.meta.env.VITE_API_URL   || "http://localhost:3005/api/v1";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE.replace("/api/v1", "");

const ESTADO_COLOR    = { presente: T.accent, tardio: T.yellow, faltante: T.red };
const ESTADO_LABEL    = { presente: "Presente", tardio: "Tardío", faltante: "Faltante" };
const CRITICIDAD_COLOR = { Alta: T.red, Media: T.yellow, Baja: T.accent };

export function SupDashboard() {
  const { token } = useAuth();

  const [data,    setData]    = useState(() => cacheRead(CACHE_KEYS.supDashboard));
  const [loading, setLoading] = useState(() => cacheRead(CACHE_KEYS.supDashboard) === null);
  const socketRef = useRef(null);

  const fetchData = async () => {
    try {
      const res  = await fetch(`${API_BASE}/dashboard/hoy`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok) { setData(json); cacheWrite(CACHE_KEYS.supDashboard, json); }
    } catch { /* silencioso — mantiene datos cacheados */ }
    finally   { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    try {
      const socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket"] });
      socketRef.current = socket;
      socket.on("guardia:entrada",  fetchData);
      socket.on("guardia:atraso",   fetchData);
      socket.on("novedad:nueva",    fetchData);
      socket.on("novedad:escalada", fetchData);
      return () => socket.disconnect();
    } catch { /* Socket.IO no disponible */ }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unirse a las salas de todas las instalaciones asignadas al cargar los datos
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !data?.kpis?.instalacionesAsignadas) return;
    data.kpis.instalacionesAsignadas.forEach(({ id }) => {
      socket.emit("join:instalacion", id);
    });
  }, [data?.kpis?.instalacionesAsignadas]);

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: T.textMut }}>Cargando...</div>;
  if (!data)   return <div style={{ textAlign: "center", padding: 40, color: T.red }}>Error al cargar datos</div>;

  const instAsignadas = data.kpis?.instalacionesAsignadas ?? [];

  return (
    <div>
      <SectionHeader title="Dashboard en Vivo" sub="Estado operacional en tiempo real" />

      {/* ── KPIs de asistencia ───────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <KPI label="Total Turnos" value={data.total}     sub="hoy"         accent={T.textSec} />
        <KPI label="Presentes"    value={data.presentes} sub="en turno"    accent={T.accent}  />
        <KPI label="Tardíos"      value={data.tardios}   sub="con retraso" accent={T.yellow}  />
        <KPI label="Faltantes"    value={data.faltantes} sub="sin marcar"  accent={T.red}     />
      </div>

      {/* ── KPIs de novedades del área ────────────────────────────── */}
      {data.kpis && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <KPI label="Nov. Abiertas"  value={data.kpis.novedadesAbiertas}  sub="activas"  accent={T.yellow} />
          <KPI label="Nov. Escaladas" value={data.kpis.novedadesEscaladas} sub="urgentes" accent={T.red}    />
        </div>
      )}

      {/* ── Mis Instalaciones (área de cobertura) ────────────────── */}
      {instAsignadas.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
            Mis Instalaciones ({instAsignadas.length})
          </div>
          <div style={{ marginBottom: 20 }}>
            {instAsignadas.map((inst) => (
              <div key={inst.id} style={{
                background: T.bgCard, border: `1px solid ${T.border}`,
                borderLeft: `3px solid ${CRITICIDAD_COLOR[inst.criticidad] ?? T.accent}`,
                borderRadius: 10, padding: "10px 14px", marginBottom: 6,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{inst.nombre}</div>
                  {inst.direccion && (
                    <div style={{ fontSize: 10, color: T.textMut, marginTop: 2 }}>{inst.direccion}</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                    background: `${CRITICIDAD_COLOR[inst.criticidad] ?? T.accent}18`,
                    color: CRITICIDAD_COLOR[inst.criticidad] ?? T.accent,
                  }}>
                    {inst.criticidad}
                  </span>
                  {inst.novedadesActivas > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                      background: T.yellowGhost, color: T.yellow,
                    }}>
                      {inst.novedadesActivas} novedad{inst.novedadesActivas !== 1 ? "es" : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Lista de guardias en turno hoy ────────────────────────── */}
      <div style={{ fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
        GGSS en Pauta Hoy
      </div>

      {data.lista.length === 0 ? (
        <div style={{
          background: T.bgCard, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: 20, textAlign: "center", fontSize: 13, color: T.textMut,
        }}>
          No hay turnos asignados para hoy
        </div>
      ) : data.lista.map((g, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`,
          borderLeft: `3px solid ${ESTADO_COLOR[g.estado]}`,
          borderRadius: 12, padding: 12, marginBottom: 6,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{g.guardia}</div>
            <div style={{ fontSize: 11, color: T.textMut }}>
              {g.instalacion} · {g.hora_inicio}–{g.hora_fin}
            </div>
            {g.hora_entrada && (
              <div style={{ fontSize: 10, color: T.textMut, marginTop: 2 }}>
                Entrada: {new Date(g.hora_entrada).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                {g.es_fallback && " · 📱 fallback móvil"}
              </div>
            )}
          </div>
          <span style={{
            background: `${ESTADO_COLOR[g.estado]}18`, color: ESTADO_COLOR[g.estado],
            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
            textTransform: "uppercase", letterSpacing: 0.8,
          }}>
            {ESTADO_LABEL[g.estado]}
          </span>
        </div>
      ))}

      <div style={{ fontSize: 10, color: T.textMut, textAlign: "center", marginTop: 12 }}>
        🔴 En vivo · Se actualiza automáticamente
      </div>
    </div>
  );
}
