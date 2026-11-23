import { useEffect, useState } from "react";
import { T } from "../../theme/theme";
import { API_URL as API_BASE } from "../../config/api";
import { ESTADO_TURNO, COLOR_URGENCIA, horaChile } from "../../utils/fichaInstalacion";

const titulo = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: T.textMut, margin: "12px 0 4px" };
const tarjeta = (color) => ({
  background: T.bgCard, border: `1px solid ${T.border}`, ...(color ? { borderLeft: `3px solid ${color}` } : {}),
  borderRadius: 8, padding: "10px 12px", fontSize: 12, color: T.textSec, width: "100%", boxSizing: "border-box",
});
const fechaCorta = (iso) => new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
const ESTADO_NOVEDAD = { abierta: "Abierta", en_atencion: "En atención", escalada: "Escalada" };

// Instalación seleccionada en el mapa: pide GET /instalaciones/:id/resumen una vez y muestra dos tarjetas
// separadas, la ficha (datos, turnos de hoy, supervisión) y las novedades abiertas, que son un acceso directo:
// al pulsar una se llama `onAbrirNovedad(id)`; `onAbrirNovedad(null)` solo lleva a la pantalla de novedades.
// Sin `onAbrirNovedad` la lista se muestra sin enlaces.
export function PanelInstalacion({ inst, color, token, onCerrar, onAbrirNovedad }) {
  const [estado, setEstado] = useState({ id: null, data: null, error: false });

  useEffect(() => {
    let vigente = true;
    fetch(`${API_BASE}/instalaciones/${encodeURIComponent(inst.id)}/resumen`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(({ data }) => { if (vigente) setEstado({ id: inst.id, data, error: false }); })
      .catch(() => { if (vigente) setEstado({ id: inst.id, data: null, error: true }); });
    return () => { vigente = false; };
  }, [inst.id, token]);

  // El resultado vale solo para la instalación que lo pidió; al cambiar de instalación vuelve a "cargando".
  const listo = estado.id === inst.id;
  const data = listo ? estado.data : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FichaInstalacion inst={inst} color={color} data={data} cargando={!listo} error={listo && estado.error} onCerrar={onCerrar} />
      {data && <NovedadesInstalacion nov={data.novedades_abiertas} onAbrir={onAbrirNovedad} />}
    </div>
  );
}

function FichaInstalacion({ inst, color, data, cargando, error, onCerrar }) {
  const datos = [inst.tipo_recinto, inst.nivel_criticidad && `Criticidad ${inst.nivel_criticidad}`, `Radio ${inst.radio_geofence_m ?? 100} m`].filter(Boolean).join(" · ");
  const lugar = [inst.direccion, inst.comuna].filter(Boolean).join(", ") || "—";
  const sups = data?.supervisores ?? [];

  return (
    <section aria-label={`Ficha de ${inst.nombre}`} style={tarjeta(color)}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <b style={{ fontSize: 13, color: T.text }}>{inst.nombre}</b>
        <button type="button" onClick={onCerrar} aria-label="Cerrar ficha"
          style={{ background: "none", border: 0, color: T.textMut, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div style={{ fontSize: 11, marginTop: 2 }}>{lugar}</div>
      <div style={{ fontSize: 11, color, marginTop: 2 }}>{datos}</div>

      {cargando && <div style={{ fontSize: 11, marginTop: 10 }}>Cargando ficha…</div>}
      {error && <div style={{ color: T.yellow, fontSize: 11, marginTop: 10 }}>No se pudo cargar la ficha.</div>}

      {data && (
        <>
          <div style={titulo}>De turno hoy</div>
          {data.turnos_hoy.length === 0
            ? <div style={{ fontSize: 11 }}>Sin turnos programados</div>
            : data.turnos_hoy.map((t) => {
              const e = ESTADO_TURNO[t.estado] ?? ESTADO_TURNO.por_iniciar;
              return (
                <div key={t.turno_id} style={{ fontSize: 11, margin: "3px 0" }}>
                  <span style={{ color: e.color }}>●</span> {t.guardia} <span style={{ color: T.textMut }}>{t.hora_inicio}–{t.hora_fin}</span>
                  <div style={{ color: e.color, fontSize: 10, marginLeft: 14 }}>{e.texto}{t.hora_entrada ? ` · entró ${horaChile(t.hora_entrada)}` : ""}</div>
                </div>
              );
            })}

          <div style={titulo}>Supervisión</div>
          <div style={{ fontSize: 11 }}>{sups.length ? sups.join(", ") : "Sin supervisor asignado"}</div>
        </>
      )}
    </section>
  );
}

function NovedadesInstalacion({ nov, onAbrir }) {
  const restantes = nov.total - nov.ultimas.length;
  const fila = { display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", font: "inherit", fontSize: 11, color: T.textSec, background: "none", border: 0, borderRadius: 6, padding: "5px 4px" };

  return (
    <section aria-label="Novedades abiertas de la instalación" style={tarjeta()}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: T.textMut, marginBottom: 4 }}>
        Novedades abiertas · {nov.total}
      </div>
      {nov.total === 0 && <div style={{ fontSize: 11 }}>Ninguna</div>}
      {nov.ultimas.map((n) => {
        const contenido = (
          <>
            <span style={{ color: COLOR_URGENCIA[n.urgencia] ?? T.textMut }}>●</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              #{n.numero} {n.tipo}
              <span style={{ display: "block", fontSize: 10, color: T.textMut }}>{ESTADO_NOVEDAD[n.estado] ?? n.estado} · {fechaCorta(n.created_at)}</span>
            </span>
            {onAbrir && <span aria-hidden="true" style={{ color: T.focusText }}>›</span>}
          </>
        );
        return onAbrir
          ? <button key={n.id} type="button" className="gc-novedad-acceso" onClick={() => onAbrir(n.id)} style={{ ...fila, cursor: "pointer" }}
              aria-label={`Abrir novedad ${n.numero}: ${n.tipo}`}>{contenido}</button>
          : <div key={n.id} style={fila}>{contenido}</div>;
      })}
      {restantes > 0 && (onAbrir
        ? <button type="button" className="gc-novedad-acceso" onClick={() => onAbrir(null)} style={{ ...fila, cursor: "pointer", color: T.focusText }}>y {restantes} más · ver en Novedades ›</button>
        : <div style={{ fontSize: 10, color: T.textMut, padding: "4px" }}>y {restantes} más</div>)}
    </section>
  );
}
