import { useEffect, useRef, useState } from "react";
import { api } from "../../services/api";
import { Btn } from "../../components/ui/Btn";
import { Input } from "../../components/ui/Input";
import { CalendarioRango, rangoDias, sumarDias } from "../../components/ui/CalendarioRango";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Badge } from "../../components/ui/Badge";
import { Icon } from "../../components/ui/Icon";
import { T } from "../../theme/theme";
import { API_URL as API_BASE } from "../../config/api";

const TIPOS = {
  vacaciones: "Vacaciones", dias_libres: "Ausentarse", turno_extra: "Turno extra", traslado: "Traslado",
};
const MAX_ADJUNTO_MB = 5;
// Cómo se eligen las fechas según el tipo:
//  vacaciones → un clic autocompleta 3 semanas · ausentarse → días sueltos o rango ·
//  turno extra → días sueltos (marcar/desmarcar) · traslado → una sola fecha.
const VACACIONES_DIAS = 21;
const RAPIDAS = [7, 14, 21];
const AYUDA = {
  vacaciones: "Elige el primer día: se marcan las semanas siguientes automáticamente.",
  dias_libres: "Marca los días que te ausentarás (vuelve a tocar para quitarlos) o usa «Rango» para elegir inicio y fin.",
  turno_extra: "Marca cada día en que quieres un turno extra; vuelve a tocar para quitarlo.",
  traslado: "Elige la fecha del traslado.",
};
const corta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });

const ICONOS = { vacaciones: "umbrella", dias_libres: "ban", turno_extra: "plus", traslado: "refresh-cw" };
const colorEstado = (estado = "") => /aprob/i.test(estado) ? "accent" : /rechaz/i.test(estado) ? "red" : "yellow";
const fechaLarga = (iso) => iso ? new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "";
const tarjeta = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 };
const etiqueta = { fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 };

export function SolicitudesPersonales() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [tipo, setTipo] = useState("vacaciones");
  const [fechas, setFechas] = useState([]);        // días elegidos (YYYY-MM-DD, ordenados)
  const [dias, setDias] = useState(VACACIONES_DIAS); // duración de las vacaciones
  const [modoAusencia, setModoAusencia] = useState("sueltos"); // "sueltos" | "rango"
  const [ancla, setAncla] = useState(null);          // primer clic de un rango en curso
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

  const reiniciar = (nuevoTipo, nuevoModo = modoAusencia) => { setFechas([]); setAncla(null); setTipo(nuevoTipo); setModoAusencia(nuevoModo); };
  const alternar = (iso) => setFechas(prev => (prev.includes(iso) ? prev.filter(f => f !== iso) : [...prev, iso].sort()));
  const elegir = (iso) => {
    if (tipo === "vacaciones") return setFechas(rangoDias(iso, sumarDias(iso, dias - 1)));
    if (tipo === "traslado") return setFechas([iso]);
    if (tipo === "dias_libres" && modoAusencia === "rango") {
      if (!ancla) { setAncla(iso); return setFechas([iso]); }
      setAncla(null);
      return setFechas(rangoDias(ancla, iso));
    }
    return alternar(iso);
  };
  const cambiarDuracion = (n) => { setDias(n); if (tipo === "vacaciones" && fechas.length) setFechas(rangoDias(fechas[0], sumarDias(fechas[0], n - 1))); };
  const esRango = tipo === "vacaciones" || (tipo === "dias_libres" && modoAusencia === "rango");
  const destacados = esRango && fechas.length ? [fechas[0], fechas[fechas.length - 1]] : tipo === "vacaciones" ? [] : fechas;

  const crear = async (evento) => {
    evento.preventDefault();
    setError("");
    setOcupado(true);
    try {
      const variasFechas = !esRango && ["dias_libres", "turno_extra"].includes(tipo);
      let nueva;
      if (archivo) {
        const form = new FormData();
        form.append("tipo", tipo);
        form.append("fecha_desde", fechas[0]);
        if (esRango && fechas.length > 1) form.append("fecha_hasta", fechas[fechas.length - 1]);
        if (variasFechas) form.append("fechas", JSON.stringify(fechas));
        if (motivo) form.append("motivo", motivo);
        form.append("adjunto", archivo);
        const res = await fetch(`${API_BASE}/solicitudes`, {
          method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("gc_token")}` }, body: form,
        });
        const cuerpo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(cuerpo.error || `Error ${res.status}`);
        nueva = cuerpo;
      } else {
        nueva = await api.post("/solicitudes", {
          tipo, fecha_desde: fechas[0], motivo,
          ...(esRango && fechas.length > 1 ? { fecha_hasta: fechas[fechas.length - 1] } : {}),
          ...(variasFechas ? { fechas } : {}),
        });
      }
      const nuevas = Array.isArray(nueva) ? nueva : [nueva];
      setSolicitudes(prev => [...nuevas, ...prev.filter(s => !nuevas.some(n => n.id === s.id))]);
      setFechas([]);
      setAncla(null);
      setMotivo("");
      setArchivo(null);
      if (archivoRef.current) archivoRef.current.value = "";
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const resumen = !fechas.length ? "Aún no has elegido fechas."
    : esRango ? `${corta(fechas[0])}${fechas.length > 1 ? ` → ${corta(fechas[fechas.length - 1])}` : ""} · ${fechas.length} ${fechas.length === 1 ? "día" : "días"}${ancla ? " (elige el día final)" : ""}`
      : `${fechas.length} ${fechas.length === 1 ? "día" : "días"}: ${fechas.map(corta).join(", ")}`;

  return (
    <div className="guard-screen">
      <SectionHeader title="Mis solicitudes" sub="Pide vacaciones, días libres o turnos extra" />
      <form onSubmit={crear} style={{ ...tarjeta, marginBottom: 20 }}>
        <div style={etiqueta}>Tipo de solicitud</div>
        <div className="guard-action-grid" style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {Object.entries(TIPOS).map(([id, label]) => (
            <button type="button" className="touch-target gc-accion-btn gc-accion-btn--morado" key={id} aria-pressed={tipo === id} onClick={() => reiniciar(id)} style={{
              background: tipo === id ? T.focusGhost : "transparent",
              border: `1px solid ${tipo === id ? T.borderFocus : T.border}`, borderRadius: 8,
              padding: "12px 8px", color: tipo === id ? T.focusText : T.text, fontSize: 12, fontWeight: 600,
              cursor: "pointer", textAlign: "center", fontFamily: "var(--font-ui)", transition: "all 0.15s",
            }}><Icon name={ICONOS[id] ?? "file-pen"} size={16} /> {label}</button>
          ))}
        </div>
        <div style={{ ...etiqueta, marginBottom: 6, textTransform: "none", letterSpacing: 0, fontSize: 12, fontWeight: 500, color: T.textSec }}>
          {tipo === "vacaciones" ? "Primer día de vacaciones" : tipo === "traslado" ? "Fecha del traslado" : "Fechas"}
        </div>
        <div style={{ fontSize: 11, color: T.textMut, marginBottom: 8 }}>{AYUDA[tipo]}</div>
        {tipo === "dias_libres" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {[["sueltos", "Días sueltos"], ["rango", "Rango"]].map(([id, label]) => (
              <button type="button" key={id} aria-pressed={modoAusencia === id} onClick={() => reiniciar(tipo, id)} className="gc-accion-btn gc-accion-btn--morado" style={{
                background: modoAusencia === id ? T.focusGhost : "transparent", border: `1px solid ${modoAusencia === id ? T.borderFocus : T.border}`,
                color: modoAusencia === id ? T.focusText : T.text, borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)",
              }}>{label}</button>
            ))}
          </div>
        )}
        <CalendarioRango marcados={fechas} destacados={destacados} onElegir={elegir} />
        {tipo === "vacaciones" && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "12px 0 0" }}>
            <span style={{ fontSize: 12, color: T.textSec }}>Duración:</span>
            {RAPIDAS.map(n => (
              <button type="button" key={n} aria-pressed={dias === n} onClick={() => cambiarDuracion(n)} className="gc-accion-btn gc-accion-btn--morado" style={{
                background: dias === n ? T.focusGhost : "transparent", border: `1px solid ${dias === n ? T.borderFocus : T.border}`,
                color: dias === n ? T.focusText : T.text, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-ui)",
              }}>{n / 7} {n === 7 ? "semana" : "semanas"}</button>
            ))}
          </div>
        )}
        <div style={{ fontSize: 12, color: fechas.length ? T.focusText : T.textMut, margin: "12px 0 16px" }}>
          {resumen}
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
        <Btn type="submit" loading={ocupado} disabled={!fechas.length} full>Enviar solicitud</Btn>
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
