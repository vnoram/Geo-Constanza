import { useEffect, useState } from "react";
import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Input } from "../../components/ui/Input";
import { SubHeader } from "../../components/ui/SubHeader";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";

// ─── SELECTOR GENÉRICO ───────────────────────────────────────────
function Select({ label, value, onChange, options, placeholder }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && (
        <label style={{
          display: "block", fontSize: 11, fontWeight: 700, color: T.textSec,
          marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase",
        }}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", background: T.bgInput, border: `1.5px solid ${T.border}`,
          borderRadius: 12, padding: "12px 14px", color: value ? T.text : T.textMut,
          fontSize: 14, fontFamily: "'Outfit', sans-serif", outline: "none",
          cursor: "pointer",
        }}
      >
        <option value="" disabled>{placeholder || "Seleccionar..."}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: T.bgCard }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── MODAL PAUTA 4x4 ─────────────────────────────────────────────
function ModalPauta4x4({ onClose, onSuccess, guardias, instalaciones }) {
  const [form, setForm] = useState({
    usuario_id: "",
    instalacion_id: "",
    fecha_inicio: "",
    hora_inicio: "08:00",
    hora_fin: "20:00",
  });
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const validar = () => {
    if (!form.usuario_id) return "Selecciona un guardia.";
    if (!form.instalacion_id) return "Selecciona una instalación.";
    if (!form.fecha_inicio) return "Indica la fecha de inicio.";
    if (!form.hora_inicio || !form.hora_fin) return "Completa los horarios.";
    if (form.hora_inicio >= form.hora_fin) return "La hora de entrada debe ser anterior a la de salida.";
    return null;
  };

  const handleConfirmar = async () => {
    const err = validar();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/turnos/pauta-4x4", form);
      setResultado(res);
      onSuccess();
    } catch (e) {
      setError(e.message || "Error al generar la pauta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(6,13,24,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 18,
        padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: T.text }}>Generar Pauta 4×4</div>
            <div style={{ fontSize: 12, color: T.textMut, marginTop: 2 }}>
              32 días · 4 trabajo / 4 descanso
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: T.textMut, fontSize: 20,
            cursor: "pointer", lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Resultado de éxito */}
        {resultado ? (
          <div>
            <div style={{
              background: T.accentGhost, border: `1px solid ${T.accent}`,
              borderRadius: 12, padding: 16, marginBottom: 20,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: T.accent, marginBottom: 8 }}>
                ✓ Pauta generada correctamente
              </div>
              <div style={{ fontSize: 13, color: T.text }}>
                <span style={{ fontWeight: 700 }}>{resultado.creados}</span> turnos creados
                {resultado.omitidos > 0 && (
                  <span style={{ color: T.yellow }}> · {resultado.omitidos} omitidos por conflicto</span>
                )}
              </div>
            </div>

            {resultado.detalles_omitidos?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <SubHeader title="Días omitidos" />
                {resultado.detalles_omitidos.map((d, i) => (
                  <div key={i} style={{
                    background: T.bgInput, borderRadius: 8, padding: "8px 12px",
                    marginBottom: 6, fontSize: 12, color: T.textSec,
                    display: "flex", justifyContent: "space-between",
                  }}>
                    <span>{d.fecha}</span>
                    <span style={{ color: T.yellow }}>{d.motivo}</span>
                  </div>
                ))}
              </div>
            )}

            <Btn full onClick={onClose}>Cerrar</Btn>
          </div>
        ) : (
          <>
            <Select
              label="Guardia (GGSS)"
              value={form.usuario_id}
              onChange={set("usuario_id")}
              placeholder="Seleccionar guardia..."
              options={guardias.map((g) => ({
                value: g.id,
                label: `${g.nombre} · ${g.rut}`,
              }))}
            />

            <Select
              label="Instalación"
              value={form.instalacion_id}
              onChange={set("instalacion_id")}
              placeholder="Seleccionar instalación..."
              options={instalaciones.map((i) => ({
                value: i.id,
                label: i.nombre,
              }))}
            />

            <Input
              label="Fecha de Inicio"
              type="date"
              value={form.fecha_inicio}
              onChange={set("fecha_inicio")}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input
                label="Hora Entrada"
                type="time"
                value={form.hora_inicio}
                onChange={set("hora_inicio")}
              />
              <Input
                label="Hora Salida"
                type="time"
                value={form.hora_fin}
                onChange={set("hora_fin")}
              />
            </div>

            {/* Info visual del ciclo */}
            <div style={{
              background: T.bgInput, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: 12, marginBottom: 18,
              display: "flex", gap: 6, flexWrap: "wrap",
            }}>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} style={{
                  width: 30, height: 30, borderRadius: 6, display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 10,
                  fontWeight: 700,
                  background: i < 4 ? T.accentGhost : T.bgCard,
                  color: i < 4 ? T.accent : T.textMut,
                  border: `1px solid ${i < 4 ? T.accent : T.border}`,
                }}>
                  {i < 4 ? "T" : "D"}
                </div>
              ))}
              <div style={{ width: "100%", fontSize: 11, color: T.textMut, marginTop: 4 }}>
                T = Trabajo · D = Descanso · ciclo × 4 = 32 días
              </div>
            </div>

            {error && (
              <div style={{
                background: T.redGhost, border: `1px solid ${T.red}`,
                borderRadius: 10, padding: "10px 14px", marginBottom: 14,
                fontSize: 13, color: T.red,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="outline" onClick={onClose} disabled={loading}>Cancelar</Btn>
              <Btn full onClick={handleConfirmar} loading={loading}>Confirmar Pauta</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CARD DE TURNO ───────────────────────────────────────────────
function TurnoCard({ turno }) {
  const estadoColor = {
    programado: T.accent,
    completado: "#6C9BFF",
    cancelado: T.red,
  }[turno.estado] || T.textMut;

  return (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: "12px 16px", marginBottom: 8,
      display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 12,
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>
          {turno.usuario?.nombre || "—"}
        </div>
        <div style={{ fontSize: 12, color: T.textMut, marginTop: 2 }}>
          {turno.instalacion?.nombre} · {turno.hora_inicio} – {turno.hora_fin}
        </div>
        <div style={{ fontSize: 11, color: T.textSec, marginTop: 3 }}>
          {new Date(turno.fecha).toLocaleDateString("es-CL", {
            weekday: "short", year: "numeric", month: "short", day: "numeric",
            timeZone: "UTC",
          })}
        </div>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: estadoColor,
        background: `${estadoColor}18`, borderRadius: 6, padding: "4px 10px",
        textTransform: "uppercase", letterSpacing: 0.8,
      }}>
        {turno.estado}
      </div>
    </div>
  );
}

// ─── PANTALLA PRINCIPAL ──────────────────────────────────────────
export function AdminTurnos() {
  const [turnos, setTurnos] = useState([]);
  const [guardias, setGuardias] = useState([]);
  const [instalaciones, setInstalaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [listaTurnos, listaUsuarios, listaInstalaciones] = await Promise.all([
        api.get("/turnos"),
        api.get("/usuarios?limit=200"),   // paginado → { data: [], total, ... }
        api.get("/instalaciones"),
      ]);
      setTurnos(listaTurnos);
      // La API de usuarios devuelve { data: [], total, page, totalPages }
      const usuarios = Array.isArray(listaUsuarios) ? listaUsuarios : (listaUsuarios.data ?? []);
      setGuardias(usuarios.filter((u) => ["pauta", "libre"].includes(u.rol)));
      setInstalaciones(Array.isArray(listaInstalaciones) ? listaInstalaciones : (listaInstalaciones.data ?? []));
    } catch (e) {
      console.error("Error cargando datos:", e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const handlePautaExitosa = () => { cargarDatos(); };

  return (
    <div>
      <SectionHeader
        title="Turnos"
        sub="Gestión masiva de horarios"
        action={{ label: "⚡ Generar Pauta 4×4", onClick: () => setModalAbierto(true) }}
      />

      {/* Tarjeta de importación CSV */}
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: 20, textAlign: "center", marginBottom: 20,
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📥</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Importar Turnos</div>
        <div style={{ fontSize: 12, color: T.textMut, marginBottom: 14 }}>
          Sube un archivo CSV o Excel con los turnos programados
        </div>
        <Btn>Seleccionar Archivo</Btn>
      </div>

      {/* Lista de turnos */}
      <SubHeader title={`Todos los Turnos (${turnos.length})`} />

      {cargando ? (
        <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 30 }}>
          Cargando turnos...
        </div>
      ) : turnos.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 30 }}>
          No hay turnos registrados.
        </div>
      ) : (
        <div>
          {turnos.map((t) => <TurnoCard key={t.id} turno={t} />)}
        </div>
      )}

      {/* Modal Pauta 4x4 */}
      {modalAbierto && (
        <ModalPauta4x4
          onClose={() => setModalAbierto(false)}
          onSuccess={handlePautaExitosa}
          guardias={guardias}
          instalaciones={instalaciones}
        />
      )}
    </div>
  );
}
