import { useEffect, useState } from "react";
import { T } from "../../theme/theme";
import { API_URL as API_BASE } from "../../config/api";
import { ESTADO_TURNO, COLOR_URGENCIA, horaChile } from "../../utils/fichaInstalacion";

const titulo = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: T.textMut, margin: "12px 0 4px" };

// Ficha de la instalación seleccionada en el mapa: se muestra junto a la leyenda, no como popup.
// Pide GET /instalaciones/:id/resumen cada vez que cambia la instalación.
export function FichaInstalacion({ inst, color, token, onCerrar }) {
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
  const cargando = !listo;
  const data = listo ? estado.data : null;
  const error = listo && estado.error;
  const datos = [inst.tipo_recinto, inst.nivel_criticidad && `Criticidad ${inst.nivel_criticidad}`, `Radio ${inst.radio_geofence_m ?? 100} m`].filter(Boolean).join(" · ");
  const lugar = [inst.direccion, inst.comuna].filter(Boolean).join(", ") || "—";
  const nov = data?.novedades_abiertas;
  const sups = data?.supervisores ?? [];

  return (
    <section aria-label={`Ficha de ${inst.nombre}`} style={{
      background: T.bgCard, border: `1px solid ${T.border}`, borderLeft: `3px solid ${color}`, borderRadius: 8,
      padding: "10px 12px", fontSize: 12, color: T.textSec, width: "100%", boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <b style={{ fontSize: 13, color: T.text }}>{inst.nombre}</b>
        <button type="button" onClick={onCerrar} aria-label="Cerrar ficha"
          style={{ background: "none", border: 0, color: T.textMut, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div style={{ fontSize: 11, marginTop: 2 }}>{lugar}</div>
      <div style={{ fontSize: 11, color, marginTop: 2 }}>{datos}</div>

      {cargando && <div style={{ ...titulo, textTransform: "none" }}>Cargando ficha…</div>}
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

          <div style={titulo}>Novedades abiertas</div>
          {nov.total === 0
            ? <div style={{ fontSize: 11 }}>Ninguna</div>
            : (
              <>
                <div style={{ fontSize: 11 }}>
                  <b>{nov.total}</b> · {["rojo", "amarillo", "verde"].filter((u) => nov[u] > 0).map((u) => (
                    <span key={u} style={{ color: COLOR_URGENCIA[u], marginRight: 8 }}>● {nov[u]} {u}</span>
                  ))}
                </div>
                {nov.ultimas.map((n) => (
                  <div key={n.numero} style={{ fontSize: 10, color: T.textMut, marginTop: 2 }}>
                    <span style={{ color: COLOR_URGENCIA[n.urgencia] ?? T.textMut }}>●</span> #{n.numero} {n.tipo}
                  </div>
                ))}
              </>
            )}

          <div style={titulo}>Supervisión</div>
          <div style={{ fontSize: 11 }}>{sups.length ? sups.join(", ") : "Sin supervisor asignado"}</div>
        </>
      )}
    </section>
  );
}
