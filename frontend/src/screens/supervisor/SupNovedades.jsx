import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";
import { SOCKET_URL } from "../../config/api";
import { esRutina } from "../../utils/novedades";


const URGENCIA_COLOR = {
  rojo:     { border: T.red,    badge: "red" },
  amarillo: { border: T.yellow, badge: "yellow" },
  verde:    { border: T.accent, badge: "accent" },
};

function formatFechaHora(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "America/Santiago",
  });
}

// ─── Modal: Resolver con comentario ──────────────────────────────────
export function ResolverModal({ novedad, onClose, onSuccess }) {
  const [comentario, setComentario] = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (comentario.trim().length < 5) {
      setError("Escribe cómo se resolvió (mínimo 5 caracteres).");
      return;
    }
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
          <span style={{ fontWeight: 700, fontSize: 15, color: T.focusText }}>Resolver Novedad</span>
          <button className="touch-target" aria-label="Cerrar" onClick={onClose} style={{
            background: "none", border: "none", color: T.textMut, fontSize: 20, cursor: "pointer",
          }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: T.textSec, marginBottom: 16 }}>
          <strong style={{ color: (URGENCIA_COLOR[novedad.urgencia] ?? URGENCIA_COLOR.verde).border }}>{novedad.tipo}</strong>
          {" — "}{novedad.descripcion}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: T.textSec, marginBottom: 6 }}>
              Comentario de cierre (obligatorio, mínimo 5 caracteres)
            </label>
            <textarea
              className="touch-target"
              value={comentario}
              onChange={e => { setComentario(e.target.value); if (error) setError(null); }}
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
            <Btn variant="ghost" className="gc-accion-btn gc-accion-btn--naranja" onClick={onClose} disabled={loading}>Cancelar</Btn>
            <Btn variant="ghost" className="gc-accion-btn gc-accion-btn--verde" loading={loading}>Marcar como resuelta</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tarjeta compacta de novedad (una fila); al pulsarla se abre el detalle ───
export function TarjetaNovedadCompacta({ n, onClick }) {
  const urgencia = n.urgencia ?? "verde";
  const colors   = URGENCIA_COLOR[urgencia] ?? URGENCIA_COLOR.verde;
  const resuelta = n.estado === "resuelta";
  const escalada = n.estado === "escalada";
  const instNombre = n.instalacion?.nombre ?? "—";
  return (
            <button className="touch-target nov-card-compacta nov-ronda" onClick={onClick}
              title="Ver detalle" style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                "--nov-c": colors.border,
                background: T.bgCard, borderRadius: 8, border: `2px solid ${esRutina(n) ? T.border : colors.border}`,
                padding: "10px 14px", cursor: "pointer", fontFamily: "var(--font-ui)", minWidth: 0,
              }}>
              <span className="nov-ronda__tipo" style={{ fontWeight: 700, fontSize: 14, color: esRutina(n) ? T.text : colors.border, whiteSpace: "nowrap" }}>{n.tipo}</span>
              <span style={{ fontSize: 12, color: esRutina(n) ? T.textSec : "#B39BE0", fontWeight: 600, whiteSpace: "nowrap" }}>{instNombre}</span>
              <span style={{ fontSize: 12, color: T.textSec, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {n.descripcion}
              </span>
              {!esRutina(n) && !resuelta && (
                <Badge color={escalada ? "red" : "yellow"}>{String(n.estado).replace("_", " ")}</Badge>
              )}
              {!esRutina(n) && <span className="nov-ronda__badge"><Badge color={colors.badge}>{urgencia}</Badge></span>}
            </button>
  );
}

// ─── Detalle de una novedad (ventana emergente) ─────────────────────
export function DetalleNovedadModal({ novedad: n, onClose, onResolver, onEscalar, onDerivar, escalando }) {
  const colors = URGENCIA_COLOR[n.urgencia ?? "verde"] ?? URGENCIA_COLOR.verde;
  const fila = (etiqueta, valor) => valor ? (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: "#9F8FC4", fontWeight: 600, marginBottom: 3 }}>{etiqueta}</div>
      <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap" }}>{valor}</div>
    </div>
  ) : null;
  return (
    <div className="responsive-modal-overlay" onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 100, background: "rgba(14,23,20,0.85)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div className="responsive-modal" onClick={e => e.stopPropagation()} style={{
        background: T.bgCard, border: `2px solid ${colors.border}`, borderRadius: 8, padding: 24,
        width: "100%", maxWidth: 760, maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: colors.border }}>{n.tipo}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge color={colors.badge}>{n.urgencia ?? "verde"}</Badge>
            <button className="touch-target" aria-label="Cerrar" onClick={onClose} style={{
              background: "none", border: "none", color: T.textMut, fontSize: 20, cursor: "pointer",
            }}>✕</button>
          </div>
        </div>
        {n.foto_url_firmada && (
          <img src={n.foto_url_firmada} alt="Foto adjunta a la novedad" style={{
            display: "block", width: "100%", height: "auto", maxHeight: "50vh", objectFit: "contain",
            background: T.bgInput, borderRadius: 8, border: `1px solid ${T.border}`, marginBottom: 14,
          }} />
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 28px", alignItems: "start" }}>
          {/* Datos cortos a la izquierda */}
          <div>
            {fila("Instalación", n.instalacion?.nombre)}
            {fila("Guardia", n.usuario?.nombre)}
            {fila("Reportada", formatFechaHora(n.created_at))}
            {fila("Estado", n.estado ? (n.estado.charAt(0).toUpperCase() + n.estado.slice(1)).replace("_", " ") : null)}
            {n.estado === "resuelta" && fila("Resuelta el", n.fecha_atencion ? formatFechaHora(n.fecha_atencion) : null)}
            {n.estado === "resuelta" && fila("Resuelta por", n.responsable?.nombre)}
            {n.estado === "en_atencion" && fila("Derivada a", n.responsable?.nombre)}
            {n.gps_dentro_rango === false && (
              <div style={{ marginTop: 4 }}><Badge color="yellow">GPS fuera de rango</Badge></div>
            )}
          </div>
          {/* Textos largos a la derecha: crecen sin empujar el resto */}
          <div style={{ minWidth: 0, maxHeight: "40vh", overflowY: "auto", overflowWrap: "anywhere" }}>
            {fila("Descripción", n.descripcion)}
            {n.estado === "resuelta" && fila("Comentario de cierre", n.comentario_cierre)}
          </div>
        </div>
        {(onResolver || onDerivar) && n.estado !== "resuelta" && !esRutina(n) && (
          <div className="action-wrap modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            {onDerivar && (
              <Btn variant="ghost" className="gc-accion-btn gc-accion-btn--morado" onClick={onDerivar}>Derivar a supervisor</Btn>
            )}
            {onEscalar && n.estado !== "escalada" && (
              <Btn variant="ghost" className="gc-accion-btn gc-accion-btn--morado" loading={escalando} onClick={onEscalar}>Escalar</Btn>
            )}
            {onResolver && (
              <Btn variant="ghost" className="gc-accion-btn gc-accion-btn--verde" onClick={onResolver}>Resolver</Btn>
            )}
          </div>
        )}
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
  const [detalle, setDetalle]         = useState(null); // novedad abierta en la ventana de detalle
  const [vista, setVista]             = useState("pendientes"); // "recientes" | "pendientes" | "resueltas"
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

    const socket = io(SOCKET_URL, { auth: (cb) => cb({ token: localStorage.getItem("gc_token") }), transports: ["websocket"] });
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
      prev.map(n => n.id === id ? { ...n, estado: "resuelta", fecha_atencion: new Date().toISOString() } : n),
    );
    setResolver(null);
  };

  const hace12h    = Date.now() - 12 * 60 * 60 * 1000;
  // Rondas y registros de rutina van aparte (Libro de rondas); no cuentan como incidencia
  const incidencias = novedades.filter(n => !esRutina(n));
  const rondas      = novedades.filter(n => esRutina(n));
  const pendientes  = incidencias.filter(n => n.estado !== "resuelta");
  const resueltas   = incidencias.filter(n => n.estado === "resuelta");
  const recientes   = incidencias.filter(n => new Date(n.created_at).getTime() >= hace12h);
  const visibles    = vista === "resueltas" ? resueltas
                    : vista === "recientes" ? recientes
                    : vista === "rondas"    ? rondas
                    : pendientes;

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

      <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { id: "recientes",  label: "Recientes",  count: recientes.length },
          { id: "pendientes", label: "Pendientes", count: pendientes.length },
          { id: "resueltas", label: "Resueltas", count: resueltas.length },
          { id: "rondas",     label: "Libro de rondas", count: rondas.length },
        ].map(t => {
          const activo = vista === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={activo}
              className="touch-target gc-tab-btn"
              onClick={() => setVista(t.id)}
              style={{
                padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: "var(--font-ui)",
                background: activo ? "rgba(122,78,191,0.22)" : "transparent",
                color: activo ? "#D2C6EE" : T.textSec,
                border: `1px solid ${activo ? "rgba(159,131,214,0.75)" : T.border}`,
              }}
            >
              {t.label} ({t.count})
            </button>
          );
        })}
      </div>

      {!loading && visibles.length === 0 && (
        <div style={{
          textAlign: "center", color: T.textMut, padding: 32, fontSize: 14,
          background: T.bgCard, borderRadius: 8, border: `1px solid ${T.border}`,
        }}>
          {vista === "resueltas" ? "Aún no hay novedades resueltas."
            : vista === "recientes" ? "No hay novedades en las últimas 12 h."
            : vista === "rondas"    ? "Aún no hay rondas registradas."
            : "No hay novedades pendientes."}
        </div>
      )}

      <div className="nov-list">
      {visibles.map(n => {
        // Todas las novedades: tarjeta compacta; al pulsarla se abre el detalle completo
        return (
            <TarjetaNovedadCompacta key={n.id} n={n} onClick={() => setDetalle(n)} />
        );
      })}
      </div>

      {detalle && (
        <DetalleNovedadModal
          novedad={novedades.find(x => x.id === detalle.id) ?? detalle}
          onClose={() => setDetalle(null)}
          escalando={!!actionLoading[detalle.id]}
          onResolver={() => { const n = detalle; setDetalle(null); setResolver(n); }}
          onEscalar={async () => { await handleEscalar(detalle.id); setDetalle(null); }}
        />
      )}

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
