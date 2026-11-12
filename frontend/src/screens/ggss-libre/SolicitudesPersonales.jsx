import { useEffect, useRef, useState } from "react";
import { api } from "../../services/api";
import { Btn } from "../../components/ui/Btn";
import { Input } from "../../components/ui/Input";
import { CalendarioRango, sumarDias } from "../../components/ui/CalendarioRango";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Badge } from "../../components/ui/Badge";
import { Icon } from "../../components/ui/Icon";
import { T } from "../../theme/theme";
import { API_URL as API_BASE } from "../../config/api";

const TIPOS = {
  vacaciones: "Vacaciones", dias_libres: "Ausentarse", turno_extra: "Turno extra", traslado: "Traslado",
};
const MAX_ADJUNTO_MB = 5;
// Duración sugerida: unas vacaciones suelen ser de 3 semanas; el resto, un solo día.
const DURACION_SUGERIDA = { vacaciones: 21 };
const RAPIDAS = [1, 7, 14, 21];
const corta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });

const ICONOS = { vacaciones: "umbrella", dias_libres: "ban", turno_extra: "plus", traslado: "refresh-cw" };
const colorEstado = (estado = "") => /aprob/i.test(estado) ? "accent" : /rechaz/i.test(estado) ? "red" : "yellow";
const fechaLarga = (iso) => iso ? new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "";
const tarjeta = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 };
const etiqueta = { fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 };

export function SolicitudesPersonales() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [tipo, setTipo] = useState("vacaciones");
  const [fecha, setFecha] = useState("");
  const [dias, setDias] = useState(DURACION_SUGERIDA.vacaciones);
  const [motivo, setMotivo] = useState("");
  const [archivo, setArchivo] = useState(null);
  const archivoRef = useRef(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let activo = true;
    api.get("/solicitudes").then(({ data }) => { if (activo) setSolicitudes(data); })
      .catch(err => { if (activo) setError(err.message); });
    return () => { activo = false; };
  }, []);

  const crear = async (evento) => {
    evento.preventDefault();
    setError("");
    setOcupado(true);
    try {
      let nueva;
      if (archivo) {
        const form = new FormData();
        form.append("tipo", tipo);
        form.append("fecha_desde", fecha);
        if (dias > 1) form.append("fecha_hasta", sumarDias(fecha, dias - 1));
        if (motivo) form.append("motivo", motivo);
        form.append("adjunto", archivo);
        const res = await fetch(`${API_BASE}/solicitudes`, {
          method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("gc_token")}` }, body: form,
        });
        const cuerpo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(cuerpo.error || `Error ${res.status}`);
        nueva = cuerpo;
      } else {
        nueva = await api.post("/solicitudes", { tipo, fecha_desde: fecha, fecha_hasta: dias > 1 ? sumarDias(fecha, dias - 1) : undefined, motivo });
      }
      setSolicitudes(prev => [nueva, ...prev.filter(s => s.id !== nueva.id)]);
      setFecha("");
      setMotivo("");
      setArchivo(null);
      if (archivoRef.current) archivoRef.current.value = "";
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="guard-screen">
      <SectionHeader title="Mis solicitudes" sub="Pide vacaciones, días libres o turnos extra" />
      <form onSubmit={crear} style={{ ...tarjeta, marginBottom: 20 }}>
        <div style={etiqueta}>Tipo de solicitud</div>
        <div className="guard-action-grid" style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {Object.entries(TIPOS).map(([id, label]) => (
            <button type="button" className="touch-target gc-accion-btn gc-accion-btn--morado" key={id} aria-pressed={tipo === id} onClick={() => { setTipo(id); setDias(DURACION_SUGERIDA[id] ?? 1); }} style={{
              background: tipo === id ? T.focusGhost : "transparent",
              border: `1px solid ${tipo === id ? T.borderFocus : T.border}`, borderRadius: 8,
              padding: "12px 8px", color: tipo === id ? T.focusText : T.text, fontSize: 12, fontWeight: 600,
              cursor: "pointer", textAlign: "center", fontFamily: "var(--font-ui)", transition: "all 0.15s",
            }}><Icon name={ICONOS[id] ?? "file-pen"} size={16} /> {label}</button>
          ))}
        </div>
        <div style={{ ...etiqueta, marginBottom: 6, textTransform: "none", letterSpacing: 0, fontSize: 12, fontWeight: 500, color: T.textSec }}>Fecha de inicio</div>
        <CalendarioRango inicio={fecha} dias={dias} onElegir={setFecha} />
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "12px 0 6px" }}>
          <span style={{ fontSize: 12, color: T.textSec }}>Duración:</span>
          {RAPIDAS.map(n => (
            <button type="button" key={n} aria-pressed={dias === n} onClick={() => setDias(n)} className="gc-accion-btn gc-accion-btn--morado" style={{
              background: dias === n ? T.focusGhost : "transparent", border: `1px solid ${dias === n ? T.borderFocus : T.border}`,
              color: dias === n ? T.focusText : T.text, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)",
            }}>{n === 1 ? "1 día" : `${n} días`}</button>
          ))}
          <input type="number" min={1} max={60} value={dias} aria-label="Días" onChange={e => setDias(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
            style={{ width: 56, background: T.bgInput, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 12 }} />
        </div>
        <div style={{ fontSize: 12, color: fecha ? T.focusText : T.textMut, marginBottom: 16 }}>
          {fecha ? `${corta(fecha)}${dias > 1 ? ` → ${corta(sumarDias(fecha, dias - 1))}` : ""} · ${dias} ${dias === 1 ? "día" : "días"}` : "Elige el día de inicio en el calendario."}
        </div>
        <Input label="Motivo (opcional)" icon="file-pen" value={motivo} onChange={setMotivo} maxLength={500} placeholder="Cuéntale brevemente al supervisor" />
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textSec, marginBottom: 6 }}>Adjuntar archivo (opcional)</label>
          <input ref={archivoRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > MAX_ADJUNTO_MB * 1024 * 1024) { setError(`El archivo supera los ${MAX_ADJUNTO_MB} MB.`); e.target.value = ""; setArchivo(null); return; }
            setError(""); setArchivo(f);
          }} style={{ color: T.textSec, fontSize: 12, maxWidth: "100%" }} />
          <div style={{ fontSize: 11, color: T.textMut, marginTop: 4 }}>Imagen (JPG, PNG, WebP) o PDF, hasta {MAX_ADJUNTO_MB} MB. Útil para certificados o comprobantes.</div>
        </div>
        <Btn type="submit" loading={ocupado} disabled={!fecha} full>Enviar solicitud</Btn>
        {error && <div role="alert" style={{ fontSize: 12, color: T.alert, marginTop: 10 }}>{error}</div>}
      </form>

      <div style={etiqueta}>Historial</div>
      {solicitudes.length === 0 ? (
        <div style={{ ...tarjeta, textAlign: "center", padding: 24, color: T.textMut, fontSize: 13 }}>
          <Icon name="file-pen" size={16} /> Aún no tienes solicitudes registradas
        </div>
      ) : solicitudes.map(s => (
        <div key={s.id} style={{ ...tarjeta, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderLeft: `3px solid ${T[colorEstado(s.estado)]}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}><Icon name={ICONOS[s.tipo] ?? "file-pen"} size={16} /> {TIPOS[s.tipo] ?? s.tipo}</div>
            <div style={{ fontSize: 11, color: T.textMut, marginTop: 2 }}>{fechaLarga(s.fecha_desde)}{s.fecha_hasta && s.fecha_hasta.slice(0, 10) !== s.fecha_desde?.slice(0, 10) ? ` → ${fechaLarga(s.fecha_hasta)}` : ""}{s.motivo ? ` · ${s.motivo}` : ""}</div>
            {s.adjunto_url_firmada && <a href={s.adjunto_url_firmada} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.focusText }}><Icon name="file-pen" size={14} /> {s.adjunto_nombre || "Ver adjunto"}</a>}
          </div>
          <Badge color={colorEstado(s.estado)}>{s.estado}</Badge>
        </div>
      ))}
    </div>
  );
}
