import { Aparecer } from "../../components/ui/Aparecer";
import { Selector } from "../../components/ui/Selector";
import { useEffect, useState, useCallback } from "react";
import { T } from "../../theme/theme";
import { api } from "../../services/api";
import { Btn } from "../../components/ui/Btn";
import { Icon } from "../../components/ui/Icon";
import { Dialogo } from "../../components/ui/Dialogo";

const fechaCorta = (f) => new Date(f).toLocaleDateString("es-CL", { day: "2-digit", month: "short", timeZone: "UTC" });

// Aviso para el supervisor: turnos futuros cuya instalación fue desactivada. Se reasignan a otra instalación activa.
export function TurnosPorReasignar() {
  const [turnos, setTurnos] = useState([]);
  const [destinos, setDestinos] = useState([]);
  const [elegido, setElegido] = useState({}); // turnoId -> instalacion_id
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const lista = await api.get("/turnos/por-reasignar");
      setTurnos(Array.isArray(lista) ? lista : []);
      window.dispatchEvent(new Event("gc:reasignar-cambio"));
    } catch { /* sin conexión: se mantiene lo último */ }
  }, []);

  useEffect(() => {
    cargar();
    api.get("/instalaciones?estado=activo")
      .then((r) => setDestinos(Array.isArray(r) ? r : (r.data ?? [])))
      .catch(() => {});
  }, [cargar]);

  const reasignar = async (turno) => {
    const destino = elegido[turno.id];
    if (!destino) return;
    setOcupado(turno.id);
    try {
      await api.put(`/turnos/${turno.id}`, { instalacion_id: destino });
      await cargar();
    } catch (e) {
      setError(e?.message || "No se pudo reasignar el turno.");
    } finally {
      setOcupado(null);
    }
  };

  if (turnos.length === 0) return null;

  return (
    <Aparecer style={{ background: T.bgCard, border: `1px solid ${T.alert}`, borderLeft: `3px solid ${T.alert}`, borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
      {error && <Dialogo titulo="No se pudo reasignar" mensaje={error} soloMensaje onCancelar={() => setError("")} />}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 14, color: T.text, marginBottom: 4 }}>
        <Icon name="triangle-alert" size={16} /> Turnos por reasignar ({turnos.length})
      </div>
      <div style={{ fontSize: 12, color: T.textSec, marginBottom: 10 }}>
        Estas instalaciones fueron desactivadas. Mientras no se reasigne, el guardia no puede marcar entrada.
      </div>
      {turnos.map((t) => (
        <div key={t.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{t.usuario?.nombre}</div>
            <div style={{ fontSize: 11, color: T.textMut }}>
              {fechaCorta(t.fecha)} · {t.hora_inicio}–{t.hora_fin} · antes en {t.instalacion?.nombre} (desactivada)
            </div>
          </div>
          <Selector etiqueta="Nueva instalación" value={elegido[t.id] || "__todos__"} onChange={(valor) => { const v = valor === "__todos__" ? "" : valor; setElegido((p) => ({ ...p, [t.id]: v })); }} opciones={[{ valor: "__todos__", etiqueta: "Nueva instalación…" }, ...destinos.filter((d) => d.id !== t.instalacion_id).map((d) => ({ valor: d.id, etiqueta: d.nombre }))]} />
          <Btn variant="morado" onClick={() => reasignar(t)} disabled={!elegido[t.id]} loading={ocupado === t.id}>Reasignar</Btn>
        </div>
      ))}
    </Aparecer>
  );
}
