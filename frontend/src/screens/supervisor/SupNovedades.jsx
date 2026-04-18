import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3005";

const URGENCIA_COLOR = {
  rojo:     { border: T.red,    badge: "red" },
  amarillo: { border: T.yellow, badge: "yellow" },
  verde:    { border: T.accent, badge: "accent" },
};

function formatHora(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

// ─── Modal: Resolver con comentario ──────────────────────────────────
function ResolverModal({ novedad, onClose, onSuccess }) {
  const [comentario, setComentario] = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.patch(`/novedades/${novedad.id}/resolver`, { comentario: comentario.trim() });
      onSuccess(novedad.id);
    } catch (err) {
      setError(err.message || "Error al resolver la novedad.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(6,13,24,0.85)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: 24, width: "100%", maxWidth: 400,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>Resolver Novedad</span>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: T.textMut, fontSize: 20, cursor: "pointer",
          }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: T.textSec, marginBottom: 16 }}>
          <strong style={{ color: T.text }}>{novedad.tipo}</strong>
          {" — "}{novedad.descripcion}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: T.textSec, marginBottom: 6 }}>
              Comentario de cierre (opcional)
            </label>
            <textarea
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              placeholder="Describe cómo se resolvió..."
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", resize: "vertical",
                background: T.bgInput, border: `1px solid ${T.border}`,
                borderRadius: 8, color: T.text, fontSize: 14,
                outline: "none", fontFamily: "'Outfit', sans-serif",
                boxSizing: "border-box",
              }}
            />
          </div>
          {error && (
            <div style={{
              marginBottom: 12, padding: "8px 12px", borderRadius: 8,
              background: T.redGhost, color: T.red, fontSize: 13,
            }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Btn>
            <Btn loading={loading}>Marcar como resuelta</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────
export function SupNovedades({ user }) {
  const [novedades, setNovedades]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [resolverTarget, setResolver] = useState(null); // novedad seleccionada para resolver
  const [actionLoading, setActionLoading] = useState({}); // { [id]: true }
  const [alertaCritica, setAlertaCritica] = useState(null);
  const socketRef = useRef(null);

  const cargarNovedades = async () => {
    try {
      const res = await api.get("/novedades");
      setNovedades(res.data ?? []);
    } catch {
      // Mantener lista actual si hay error de red
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarNovedades();

    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    if (user?.instalacion_asignada_id) {
      socket.emit("join:instalacion", user.instalacion_asignada_id);
    }

    // Nueva novedad en tiempo real
    socket.on("novedad:nueva", (data) => {
      setNovedades(prev => {
        // Evitar duplicados; insertar al inicio
        if (prev.find(n => n.id === data.id)) return prev;
        return [data, ...prev];
      });
    });

    // Novedad escalada
    socket.on("novedad:escalada", ({ id }) => {
      setNovedades(prev =>
        prev.map(n => n.id === id ? { ...n, estado: "escalada" } : n),
      );
    });

    // Alerta crítica desde Central
    socket.on("alerta_critica_central", (data) => {
      setAlertaCritica(data);
      // Auto-cerrar tras 10 s
      setTimeout(() => setAlertaCritica(null), 10000);
    });

    return () => socket.disconnect();
  }, [user?.instalacion_asignada_id]);

  // ── Escalar ──────────────────────────────────────────────────────
  const handleEscalar = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await api.patch(`/novedades/${id}/escalar`);
      setNovedades(prev =>
        prev.map(n => n.id === id ? { ...n, estado: "escalada" } : n),
      );
    } catch (err) {
      alert(err.message || "Error al escalar la novedad.");
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  // ── Resolver (callback desde modal) ─────────────────────────────
  const handleResuelta = (id) => {
    setNovedades(prev =>
      prev.map(n => n.id === id ? { ...n, estado: "resuelta" } : n),
    );
    setResolver(null);
  };

  return (
    <div>
      <SectionHeader title="Novedades" sub="Ordenadas por prioridad" />

      {/* Banner alerta crítica */}
      {alertaCritica && (
        <div style={{
          background: T.redGhost, border: `1px solid ${T.red}`,
          borderRadius: 12, padding: 14, marginBottom: 12,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div>
            <div style={{ color: T.red, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              🚨 ALERTA CRÍTICA — {alertaCritica.instalacion?.nombre}
            </div>
            <div style={{ fontSize: 13, color: T.text }}>
              {alertaCritica.tipo}: {alertaCritica.descripcion}
            </div>
            <div style={{ fontSize: 12, color: T.textMut, marginTop: 4 }}>
              Guardia: {alertaCritica.guardia?.nombre}
              {alertaCritica.gps_dentro_rango === false && " · ⚠️ GPS fuera de rango"}
            </div>
          </div>
          <button onClick={() => setAlertaCritica(null)} style={{
            background: "none", border: "none", color: T.textMut, fontSize: 18, cursor: "pointer",
          }}>✕</button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", color: T.textMut, padding: 32, fontSize: 14 }}>
          Cargando novedades...
        </div>
      )}

      {!loading && novedades.length === 0 && (
        <div style={{
          textAlign: "center", color: T.textMut, padding: 32, fontSize: 14,
          background: T.bgCard, borderRadius: 12, border: `1px solid ${T.border}`,
        }}>
          No hay novedades registradas.
        </div>
      )}

      {novedades.map(n => {
        const urgencia = n.urgencia ?? "verde";
        const colors   = URGENCIA_COLOR[urgencia] ?? URGENCIA_COLOR.verde;
        const resuelta = n.estado === "resuelta";
        const escalada = n.estado === "escalada";
        const guardaNombre = n.usuario?.nombre ?? "—";
        const instNombre   = n.instalacion?.nombre ?? "—";

        return (
          <div key={n.id} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
            borderLeft: `4px solid ${colors.border}`,
            padding: 14, marginBottom: 8,
            opacity: resuelta ? 0.6 : 1,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{n.tipo}</span>
              <Badge color={colors.badge}>{urgencia}</Badge>
            </div>

            <div style={{ fontSize: 12, color: T.textMut, marginBottom: 4 }}>
              {guardaNombre} · {instNombre} · {formatHora(n.created_at)}
            </div>

            <div style={{ fontSize: 12, color: T.textSec, marginBottom: 8 }}>
              {n.descripcion}
            </div>

            {/* Badges de estado + GPS */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <Badge color={resuelta ? "accent" : escalada ? "red" : "yellow"}>
                {n.estado}
              </Badge>
              {n.gps_dentro_rango === false && (
                <Badge color="yellow">GPS fuera de rango</Badge>
              )}
            </div>

            {/* Acciones (sólo si no está resuelta) */}
            {!resuelta && (
              <div style={{ display: "flex", gap: 8 }}>
                <Btn
                  variant="ghost"
                  onClick={() => setResolver(n)}
                  disabled={!!actionLoading[n.id]}
                >
                  Resolver
                </Btn>
                {!escalada && (
                  <Btn
                    variant="ghost"
                    loading={!!actionLoading[n.id]}
                    onClick={() => handleEscalar(n.id)}
                  >
                    Escalar
                  </Btn>
                )}
              </div>
            )}
          </div>
        );
      })}

      {resolverTarget && (
        <ResolverModal
          novedad={resolverTarget}
          onClose={() => setResolver(null)}
          onSuccess={handleResuelta}
        />
      )}
    </div>
  );
}
