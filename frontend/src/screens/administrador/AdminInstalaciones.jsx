import { useState, useEffect } from "react";
import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { SubHeader } from "../../components/ui/SubHeader";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";

// ─── HELPERS ─────────────────────────────────────────────────────
const CRITICIDAD_COLOR = { Alta: "red", Media: "yellow", Baja: "accent" };

const TIPOS_RECINTO = ["Comercial", "Corporativo", "Residencial", "Industrial", "Educacional", "Salud", "Gubernamental", "Otro"];
const NIVELES_CRITICIDAD = ["Alta", "Media", "Baja"];

const FORM_INICIAL = {
  nombre:           "",
  direccion:        "",
  latitud:          "",
  longitud:         "",
  radio_geofence_m: "100",
  tipo_recinto:     "",
  nivel_criticidad: "Media",
};

// ─── SELECTOR ────────────────────────────────────────────────────
function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.textSec, marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase" }}>
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
        }}
      >
        <option value="">Seleccionar...</option>
        {options.map((o) => (
          <option key={o} value={o} style={{ background: T.bgCard }}>{o}</option>
        ))}
      </select>
    </div>
  );
}

// ─── MODAL NUEVA INSTALACIÓN ─────────────────────────────────────
function ModalNuevaInstalacion({ onClose, onCreada }) {
  const [form,     setForm]     = useState(FORM_INICIAL);
  const [loading,  setLoading]  = useState(false);
  const [errores,  setErrores]  = useState({});

  const set = (campo) => (val) => setForm((f) => ({ ...f, [campo]: val }));

  // Validación local
  const validar = () => {
    const e = {};
    if (!form.nombre.trim())              e.nombre  = "El nombre es obligatorio";
    if (!form.latitud)                    e.latitud = "La latitud es obligatoria";
    if (!form.longitud)                   e.longitud = "La longitud es obligatoria";
    if (isNaN(parseFloat(form.latitud)))  e.latitud = "Debe ser un número válido";
    if (isNaN(parseFloat(form.longitud))) e.longitud = "Debe ser un número válido";
    const lat = parseFloat(form.latitud);
    const lon = parseFloat(form.longitud);
    if (!isNaN(lat) && (lat < -90  || lat > 90))   e.latitud  = "Rango válido: -90 a 90";
    if (!isNaN(lon) && (lon < -180 || lon > 180))  e.longitud = "Rango válido: -180 a 180";
    const radio = parseInt(form.radio_geofence_m, 10);
    if (isNaN(radio) || radio < 10) e.radio_geofence_m = "Mínimo 10 metros";
    return e;
  };

  const handleSubmit = async () => {
    const e = validar();
    if (Object.keys(e).length > 0) { setErrores(e); return; }
    setErrores({});
    setLoading(true);
    try {
      const nueva = await api.post("/instalaciones", {
        nombre:           form.nombre.trim(),
        direccion:        form.direccion.trim() || undefined,
        latitud:          parseFloat(form.latitud),
        longitud:         parseFloat(form.longitud),
        radio_geofence_m: parseInt(form.radio_geofence_m, 10),
        tipo_recinto:     form.tipo_recinto     || undefined,
        nivel_criticidad: form.nivel_criticidad || "Media",
      });
      onCreada(nueva);
    } catch (err) {
      setErrores({ _global: err.message || "Error al crear instalación" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(6,13,24,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`,
        borderRadius: 18, padding: 28, width: "100%", maxWidth: 500,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: T.text }}>Nueva Instalación</div>
            <div style={{ fontSize: 12, color: T.textMut, marginTop: 2 }}>Registrar punto de seguridad</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.textMut, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* Error global */}
        {errores._global && (
          <div style={{ background: T.redGhost, border: `1px solid ${T.red}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: T.red }}>
            {errores._global}
          </div>
        )}

        <Input
          label="Nombre de la Instalación *"
          value={form.nombre}
          onChange={set("nombre")}
          placeholder="Ej: Centro Comercial Arauco"
          error={errores.nombre}
          icon="🏢"
        />

        <Input
          label="Dirección"
          value={form.direccion}
          onChange={set("direccion")}
          placeholder="Ej: Av. Libertador Bernardo O'Higgins 123"
          icon="📍"
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input
            label="Latitud *"
            type="number"
            value={form.latitud}
            onChange={set("latitud")}
            placeholder="-33.4489"
            error={errores.latitud}
          />
          <Input
            label="Longitud *"
            type="number"
            value={form.longitud}
            onChange={set("longitud")}
            placeholder="-70.6693"
            error={errores.longitud}
          />
        </div>

        <Input
          label="Radio de Geocerca (metros)"
          type="number"
          value={form.radio_geofence_m}
          onChange={set("radio_geofence_m")}
          placeholder="100"
          error={errores.radio_geofence_m}
          icon="📡"
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select
            label="Tipo de Recinto"
            value={form.tipo_recinto}
            onChange={set("tipo_recinto")}
            options={TIPOS_RECINTO}
          />
          <Select
            label="Nivel de Criticidad"
            value={form.nivel_criticidad}
            onChange={set("nivel_criticidad")}
            options={NIVELES_CRITICIDAD}
          />
        </div>

        {/* Info visual geocerca */}
        <div style={{
          background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: "10px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: `2px dashed ${T.accent}`, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 16, flexShrink: 0,
          }}>
            📡
          </div>
          <div style={{ fontSize: 11, color: T.textMut }}>
            La geocerca de <span style={{ color: T.accent, fontWeight: 700 }}>{form.radio_geofence_m || 100}m</span> define el radio en que los guardias deben estar para registrar asistencia válida.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="outline" onClick={onClose} disabled={loading}>Cancelar</Btn>
          <Btn full onClick={handleSubmit} loading={loading}>Crear Instalación</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── CARD DE INSTALACIÓN ─────────────────────────────────────────
function InstCard({ inst }) {
  const color = CRITICIDAD_COLOR[inst.nivel_criticidad] || "accent";
  return (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: "14px 16px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
        <div style={{ flex: 1, marginRight: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{inst.nombre}</div>
          {inst.direccion && (
            <div style={{ fontSize: 11, color: T.textMut, marginTop: 2 }}>{inst.direccion}</div>
          )}
        </div>
        <Badge color={color}>{inst.nivel_criticidad || "Media"}</Badge>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, fontSize: 11, color: T.textSec }}>
        {inst.tipo_recinto && (
          <span style={{ background: T.bgInput, borderRadius: 6, padding: "3px 8px" }}>
            {inst.tipo_recinto}
          </span>
        )}
        <span style={{ background: T.bgInput, borderRadius: 6, padding: "3px 8px" }}>
          📡 {inst.radio_geofence_m ?? 100}m
        </span>
        {inst.latitud && inst.longitud && (
          <span style={{ background: T.bgInput, borderRadius: 6, padding: "3px 8px", fontFamily: "monospace", fontSize: 10 }}>
            {parseFloat(inst.latitud).toFixed(4)}, {parseFloat(inst.longitud).toFixed(4)}
          </span>
        )}
        <span style={{
          background: inst.estado === "activa" || inst.estado === "activo" ? T.accentGhost : T.redGhost,
          color:      inst.estado === "activa" || inst.estado === "activo" ? T.accent        : T.red,
          borderRadius: 6, padding: "3px 8px", fontWeight: 700,
        }}>
          {inst.estado || "activo"}
        </span>
      </div>
    </div>
  );
}

// ─── PANTALLA PRINCIPAL ──────────────────────────────────────────
export function AdminInstalaciones() {
  const [instalaciones, setInstalaciones] = useState([]);
  const [cargando,      setCargando]      = useState(true);
  const [modalAbierto,  setModalAbierto]  = useState(false);
  const [confirmacion,  setConfirmacion]  = useState("");
  const [busqueda,      setBusqueda]      = useState("");

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await api.get("/instalaciones");
      setInstalaciones(Array.isArray(data) ? data : (data.data ?? []));
    } catch {
      /* error silencioso — lista vacía */
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const handleCreada = (nueva) => {
    setModalAbierto(false);
    setInstalaciones((prev) => [nueva, ...prev]);
    setConfirmacion(`✅ Instalación "${nueva.nombre}" creada correctamente`);
    setTimeout(() => setConfirmacion(""), 4000);
  };

  const listaFiltrada = instalaciones.filter((i) =>
    i.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    i.direccion?.toLowerCase().includes(busqueda.toLowerCase()) ||
    i.tipo_recinto?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <SectionHeader
        title="Instalaciones"
        sub={`${instalaciones.length} recinto${instalaciones.length !== 1 ? "s" : ""} registrado${instalaciones.length !== 1 ? "s" : ""}`}
        action={{ label: "+ Nueva Instalación", onClick: () => setModalAbierto(true) }}
      />

      {/* Confirmación */}
      {confirmacion && (
        <div style={{
          background: T.accentGhost, border: `1px solid ${T.accent}`,
          borderRadius: 10, padding: "10px 14px", marginBottom: 14,
          fontSize: 13, color: T.accent, fontWeight: 600,
        }}>
          {confirmacion}
        </div>
      )}

      {/* Buscador */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, dirección o tipo..."
          style={{
            width: "100%", background: T.bgInput, border: `1.5px solid ${T.border}`,
            borderRadius: 12, padding: "11px 14px", color: T.text,
            fontSize: 13, fontFamily: "'Outfit', sans-serif", outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Lista */}
      {cargando ? (
        <div style={{ textAlign: "center", padding: 40, fontSize: 13, color: T.textMut }}>
          Cargando instalaciones...
        </div>
      ) : listaFiltrada.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏢</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>
            {busqueda ? "Sin resultados" : "Sin instalaciones registradas"}
          </div>
          <div style={{ fontSize: 12, color: T.textMut, marginBottom: 18 }}>
            {busqueda ? "Intenta con otro término de búsqueda" : "Crea la primera instalación del sistema"}
          </div>
          {!busqueda && (
            <Btn onClick={() => setModalAbierto(true)}>+ Nueva Instalación</Btn>
          )}
        </div>
      ) : (
        <>
          <SubHeader title={`Mostrando ${listaFiltrada.length} de ${instalaciones.length}`} />
          {listaFiltrada.map((inst) => (
            <InstCard key={inst.id} inst={inst} />
          ))}
        </>
      )}

      {/* Modal */}
      {modalAbierto && (
        <ModalNuevaInstalacion
          onClose={() => setModalAbierto(false)}
          onCreada={handleCreada}
        />
      )}
    </div>
  );
}
