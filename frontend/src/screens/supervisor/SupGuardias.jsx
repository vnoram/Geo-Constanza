import { useState, useEffect } from "react";
import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { Btn } from "../../components/ui/Btn";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";
import { ROLES } from "../../constants/roles";

export function SupGuardias() {
  const [guardias, setGuardias] = useState([]);
  const [instalaciones, setInstalaciones] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [form, setForm] = useState({
    usuario_id: "",
    instalacion_id: "",
    fecha: new Date().toISOString().split("T")[0],
    hora_inicio: "06:00",
    hora_fin: "14:00",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const cargarRecursos = async () => {
    setCargandoDatos(true);
    try {
      const [resPauta, resLibre, resInstalaciones] = await Promise.all([
        api.get("/usuarios?rol=pauta&limit=100"),
        api.get("/usuarios?rol=libre&limit=100"),
        api.get("/instalaciones"),
      ]);

      const listaPauta = Array.isArray(resPauta) ? resPauta : (resPauta.data || []);
      const listaLibre = Array.isArray(resLibre) ? resLibre : (resLibre.data || []);
      const listaInst  = Array.isArray(resInstalaciones) ? resInstalaciones : (resInstalaciones.data || []);

      setGuardias([...listaPauta, ...listaLibre]);
      setInstalaciones(listaInst);

      // Si solo hay una instalación disponible, preseleccionarla automáticamente
      if (listaInst.length === 1) {
        setForm((prev) => ({ ...prev, instalacion_id: listaInst[0].id }));
      }
    } catch (err) {
      console.error("Error al cargar recursos de guardias/instalaciones:", err);
      setMsg("Error al cargar instalaciones o guardias desde el servidor.");
    } finally {
      setCargandoDatos(false);
    }
  };

  useEffect(() => {
    cargarRecursos();
  }, []);

  const crearTurno = async () => {
    if (!form.usuario_id || !form.instalacion_id || !form.fecha) {
      setMsg("Completa todos los campos obligatorios.");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      await api.post("/turnos", form);
      setMsg("Turno creado exitosamente");
      setMostrarForm(false);
      setForm({
        usuario_id: "",
        instalacion_id: instalaciones.length === 1 ? instalaciones[0].id : "",
        fecha: new Date().toISOString().split("T")[0],
        hora_inicio: "06:00",
        hora_fin: "14:00",
      });
    } catch (e) {
      setMsg(e.message || "Error al crear turno");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.bgCard, color: T.text, fontSize: 13, marginBottom: 10, boxSizing: "border-box",
    outline: "none", fontFamily: "'Outfit', sans-serif",
  };

  return (
    <div>
      <SectionHeader
        title="Guardias"
        sub="Personal asignado a tus instalaciones"
        action={{
          label: mostrarForm ? "Cerrar Formulario" : "+ Crear Turno",
          onClick: () => {
            setMostrarForm((v) => !v);
            setMsg("");
          },
        }}
      />

      {mostrarForm && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: T.text }}>
            Nuevo Turno
          </div>

          <div style={{ fontSize: 11, color: T.textMut, marginBottom: 4, fontWeight: 600 }}>GUARDIA *</div>
          <select
            style={inputStyle}
            value={form.usuario_id}
            onChange={(e) => setForm((f) => ({ ...f, usuario_id: e.target.value }))}
          >
            <option value="">Seleccionar guardia...</option>
            {guardias.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre} ({g.rol === ROLES.GGSS_EN_PAUTA ? "Pauta" : "Libre"})
              </option>
            ))}
          </select>

          <div style={{ fontSize: 11, color: T.textMut, marginBottom: 4, fontWeight: 600 }}>INSTALACIÓN *</div>
          <select
            style={inputStyle}
            value={form.instalacion_id}
            onChange={(e) => setForm((f) => ({ ...f, instalacion_id: e.target.value }))}
          >
            <option value="">Seleccionar instalación...</option>
            {instalaciones.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} {i.comuna ? `(${i.comuna})` : ""}
              </option>
            ))}
          </select>

          <div style={{ fontSize: 11, color: T.textMut, marginBottom: 4, fontWeight: 600 }}>FECHA *</div>
          <input
            type="date"
            style={inputStyle}
            value={form.fecha}
            onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textMut, marginBottom: 4, fontWeight: 600 }}>HORA INICIO</div>
              <input
                type="time"
                style={inputStyle}
                value={form.hora_inicio}
                onChange={(e) => setForm((f) => ({ ...f, hora_inicio: e.target.value }))}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMut, marginBottom: 4, fontWeight: 600 }}>HORA FIN</div>
              <input
                type="time"
                style={inputStyle}
                value={form.hora_fin}
                onChange={(e) => setForm((f) => ({ ...f, hora_fin: e.target.value }))}
              />
            </div>
          </div>

          {msg && (
            <div style={{
              fontSize: 12,
              padding: "8px 12px",
              borderRadius: 8,
              background: msg.includes("exitosamente") ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: msg.includes("exitosamente") ? T.accent : T.red,
              border: `1px solid ${msg.includes("exitosamente") ? T.accent : T.red}`,
              marginBottom: 12,
            }}>
              {msg}
            </div>
          )}

          <Btn onClick={crearTurno} disabled={loading} full>
            {loading ? "Creando..." : "Confirmar Turno"}
          </Btn>
        </div>
      )}

      {cargandoDatos ? (
        <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 20 }}>
          Cargando personal e instalaciones...
        </div>
      ) : guardias.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 20 }}>
          No hay guardias registrados.
        </div>
      ) : (
        guardias.map((g, i) => (
          <div
            key={g.id || i}
            style={{
              background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
              padding: 12, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{g.nombre}</div>
              <div style={{ fontSize: 11, color: T.textMut }}>
                GGSS {g.rol === ROLES.GGSS_EN_PAUTA ? "Pauta" : "Libre"} {g.rut ? `· ${g.rut}` : ""}
              </div>
            </div>
            <Badge color={g.estado === "activo" ? "accent" : "red"}>{g.estado}</Badge>
          </div>
        ))
      )}
    </div>
  );
}
