import "./SupDashboard.css";
import "./SupPantallas.css";
import { useCallback, useEffect, useState } from "react";
import { FONT, T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Badge } from "../../components/ui/Badge";
import { Icon } from "../../components/ui/Icon";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";

const TIPOS = { vacaciones: "Vacaciones", dias_libres: "Ausentarse", turno_extra: "Turno extra", traslado: "Traslado", turno: "Turno" };
const ICONOS = { vacaciones: "umbrella", dias_libres: "ban", turno_extra: "plus", traslado: "refresh-cw", turno: "calendar-days" };
const ESTADO = { pendiente: ["yellow", "Pendiente"], aprobada: ["accent", "Aprobada"], rechazada: ["red", "Rechazada"] };
const FILTROS = [["pendiente", "Pendientes"], ["aprobada", "Aprobadas"], ["rechazada", "Rechazadas"], ["", "Todas"]];

const dia = (iso) => {
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
};
const diasEntre = (desde, hasta) => Math.round((Date.parse(String(hasta).slice(0, 10)) - Date.parse(String(desde).slice(0, 10))) / 86400000) + 1;
const cuando = (s) => {
  if (!s.fecha_desde) return "Sin fecha";
  if (!s.fecha_hasta || String(s.fecha_hasta).slice(0, 10) === String(s.fecha_desde).slice(0, 10)) return dia(s.fecha_desde);
  return `${dia(s.fecha_desde)} → ${dia(s.fecha_hasta)} · ${diasEntre(s.fecha_desde, s.fecha_hasta)} días`;
};

const tarjeta = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 14, marginBottom: 8 };

export function SupSolicitudes() {
  const [filtro, setFiltro] = useState("pendiente");
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [rechazando, setRechazando] = useState(null); // id de la solicitud que se está rechazando
  const [comentario, setComentario] = useState("");
  const [ocupado, setOcupado] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const res = await api.get(`/solicitudes?limit=50${filtro ? `&estado=${filtro}` : ""}`);
      setLista(Array.isArray(res) ? res : (res.data || []));
    } catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  const resolver = async (s, accion) => {
    if (accion === "rechazar" && !comentario.trim()) { setError("Escribe el motivo del rechazo."); return; }
    setOcupado(s.id); setError(""); setAviso("");
    try {
      await api.patch(`/solicitudes/${s.id}/${accion === "aprobar" ? "aprobar" : "rechazar"}`,
        accion === "aprobar" ? {} : { motivo: comentario.trim() });
      setAviso(`Solicitud de ${s.usuario?.nombre || "guardia"} ${accion === "aprobar" ? "aprobada" : "rechazada"}.`);
      setRechazando(null); setComentario("");
      window.dispatchEvent(new Event("gc:solicitudes-cambio"));
      await cargar();
    } catch (err) { setError(err.message); }
    finally { setOcupado(""); }
  };

  return (
    <div className="operations-screen sup-dashboard sup-supervision sup-solicitudes">
      <SectionHeader title="Solicitudes" sub="Peticiones de tus guardias" />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {FILTROS.map(([id, label]) => (
          <button type="button" key={id || "todas"} className="touch-target gc-accion-btn gc-accion-btn--morado" aria-pressed={filtro === id}
            onClick={() => { setFiltro(id); setRechazando(null); setError(""); setAviso(""); }} style={{
              background: filtro === id ? T.focusGhost : "transparent", border: `1px solid ${filtro === id ? T.borderFocus : T.border}`,
              color: filtro === id ? T.focusText : T.text, borderRadius: T.radius, padding: "8px 14px", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: FONT.ui, transition: "all 0.15s",
            }}>{label}</button>
        ))}
      </div>

      {aviso && <div role="status" style={{ fontSize: 12, color: T.accent, marginBottom: 10 }}>{aviso}</div>}
      {error && <div role="alert" style={{ fontSize: 12, color: T.alert, marginBottom: 10 }}>{error}</div>}

      {cargando ? (
        <div style={{ textAlign: "center", padding: 24, fontSize: 13, color: T.textMut }}>Cargando solicitudes...</div>
      ) : lista.length === 0 ? (
        <div style={{ ...tarjeta, textAlign: "center", padding: 24, color: T.textMut, fontSize: 13 }}>
          <Icon name="inbox" size={16} /> {filtro === "pendiente" ? "No hay solicitudes pendientes." : "No hay solicitudes en esta vista."}
        </div>
      ) : <div className="sup-supervision__grid">{lista.map((s) => {
        const [color, etiqueta] = ESTADO[s.estado] || ["accent", s.estado];
        return (
          <div className="responsive-card sup-supervision__request" key={s.id} style={{ ...tarjeta, borderLeft: `3px solid ${T[color]}` }}>
            <div className="responsive-list-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{s.usuario?.nombre || "Guardia"}</span>
              <Badge color={color}>{etiqueta}</Badge>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.focusText, fontWeight: 600 }}>
              <Icon name={ICONOS[s.tipo] ?? "file-text"} size={16} /> {TIPOS[s.tipo] || s.tipo}
              <span style={{ color: T.text, fontWeight: 500 }}>· {cuando(s)}</span>
            </div>
            {s.motivo && <div style={{ fontSize: 12, color: T.textSec, marginTop: 6 }}>“{s.motivo}”</div>}
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 6, fontSize: 11, color: T.textMut }}>
              <span>Enviada el {dia(s.created_at)}</span>
              {s.adjunto_url_firmada && (
                <a href={s.adjunto_url_firmada} target="_blank" rel="noreferrer" style={{ color: T.accent, fontWeight: 600, textDecoration: "none" }}>
                  <Icon name="paperclip" size={14} /> {s.adjunto_nombre || "Ver adjunto"} →
                </a>
              )}
            </div>
            {s.estado !== "pendiente" && s.revisor?.nombre && (
              <div style={{ fontSize: 11, color: T.textMut, marginTop: 6 }}>
                Revisada por {s.revisor.nombre}{s.comentario_revision ? ` · “${s.comentario_revision}”` : ""}
              </div>
            )}

            {s.estado === "pendiente" && (rechazando === s.id ? (
              <div style={{ marginTop: 10 }}>
                <textarea aria-label="Motivo del rechazo (obligatorio)" value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={300} rows={2} autoFocus
                  placeholder="Motivo del rechazo (obligatorio)" style={{
                    width: "100%", boxSizing: "border-box", background: T.bgInput, color: T.text, border: `1px solid ${T.border}`,
                    borderRadius: T.radius, padding: "8px 10px", fontSize: 12, fontFamily: FONT.ui, resize: "vertical",
                  }} />
                <div className="action-wrap" style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Btn variant="rechazar" onClick={() => resolver(s, "rechazar")} loading={ocupado === s.id}>Confirmar rechazo</Btn>
                  <Btn variant="ghost" onClick={() => { setRechazando(null); setComentario(""); setError(""); }} disabled={ocupado === s.id}>Cancelar</Btn>
                </div>
              </div>
            ) : (
              <div className="action-wrap" style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Btn variant="aprobar" onClick={() => resolver(s, "aprobar")} loading={ocupado === s.id}>Aprobar</Btn>
                <Btn variant="rechazar" onClick={() => { setRechazando(s.id); setComentario(""); setError(""); }} disabled={ocupado === s.id}>Rechazar</Btn>
              </div>
            ))}
          </div>
        );
      })}</div>}
    </div>
  );
}
