import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";
import { SOCKET_URL } from "../../config/api";


const URGENCIA_COLOR = {
  rojo:     { border: T.red,    badge: "red" },
  amarillo: { border: T.yellow, badge: "yellow" },
  verde:    { border: T.accent, badge: "accent" },
};

function formatHora(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
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
    <div className="responsive-modal-overlay" style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(14,23,20,0.85)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div className="responsive-modal" style={{
        background: T.bgCard, border: `1px solid ${T.border}`,
        borderRadius: 8, padding: 24, width: "100%", maxWidth: 400,
      }}>
        <div className="responsive-list-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>Resolver Novedad</span>
          <button className="touch-target" aria-label="Cerrar" onClick={onClose} style={{
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
              className="touch-target"
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              placeholder="Describe cómo se resolvió..."
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", resize: "vertical",
                background: T.bgInput, border: `1px solid ${T.border}`,
                borderRadius: 8, color: T.text, fontSize: 14,
                outline: "none", fontFamily: "var(--font-ui)",
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
          <div className="action-wrap modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Btn>
            <Btn loading={loading}>Marcar como resuelta</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Foto de la novedad (miniatura + vista ampliada) ─────────────────
// `foto_url_firmada` es un link temporal generado por el backend; si vence,
// basta con recargar la lista para obtener uno nuevo.
function FotoNovedad({ url }) {
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div style={{ fontSize: 11, color: T.textMut, marginBottom: 10 }}>
        📷 Foto no disponible (recarga la página para renovar el enlace)
      </div>
    );
  }

  return (
    <>
      <button
        className="touch-target"
        onClick={() => setAbierta(true)}
        title="Ver foto"
        style={{
          display: "block", padding: 0, marginBottom: 10, cursor: "zoom-in",
          border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", background: T.bgInput,
        }}
      >
        <img
          src={url}
          alt="Foto adjunta a la novedad"
          loading="lazy"
          onError={() => setError(true)}
          style={{ display: "block", width: 160, height: 110, objectFit: "cover" }}
        />
      </button>

      {abierta && (
          <div
            className="responsive-modal-overlay"
          onClick={() => setAbierta(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1100, background: "rgba(14,23,20,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16, cursor: "zoom-out",
          }}
        >
          <img
            src={url}
            alt="Foto adjunta a la novedad"
            style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 8, boxShadow: "0 16px 40px rgba(0,0,0,0.6)" }}
          />
          <div style={{ position: "absolute", top: 16, right: 20, display: "flex", gap: 12, alignItems: "center" }}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: T.accent, fontSize: 13, fontWeight: 700, textDecoration: "none" }}
            >
              Abrir original ↗
            </a>
            <button
              className="touch-target"
              aria-label="Cerrar foto"
              onClick={() => setAbierta(false)}
              style={{ background: "none", border: "none", color: T.text, fontSize: 22, cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
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
        const nueva = {
          ...data,
          usuario: data.usuario ?? data.guardia,
          instalacion: data.instalacion ?? { id: data.instalacion_id, nombre: data.instalacion_nombre },
        };
        return [nueva, ...prev];
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
    <div className="operations-screen">
      <SectionHeader title="Novedades" sub="Ordenadas por prioridad" />

      {/* Banner alerta crítica */}
      {alertaCritica && (
        <div className="responsive-list-row" style={{
          background: T.redGhost, border: `1px solid ${T.red}`,
          borderRadius: 8, padding: 14, marginBottom: 12,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div className="responsive-list-row__main">
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
          <button className="touch-target" aria-label="Cerrar alerta" onClick={() => setAlertaCritica(null)} style={{
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
          background: T.bgCard, borderRadius: 8, border: `1px solid ${T.border}`,
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
          <div className="responsive-card" key={n.id} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
            borderLeft: `4px solid ${colors.border}`,
            padding: 14, marginBottom: 8,
            opacity: resuelta ? 0.6 : 1,
          }}>
            <div className="responsive-list-row" style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{n.tipo}</span>
              <Badge color={colors.badge}>{urgencia}</Badge>
            </div>

            <div style={{ fontSize: 12, color: T.textMut, marginBottom: 4 }}>
              {guardaNombre} · {instNombre} · {formatHora(n.created_at)}
            </div>

            <div style={{ fontSize: 12, color: T.textSec, marginBottom: 8 }}>
              {n.descripcion}
            </div>

            {n.foto_url_firmada && <FotoNovedad url={n.foto_url_firmada} />}

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
              <div className="action-wrap" style={{ display: "flex", gap: 8 }}>
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
