import { useState, useEffect } from "react";
import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { Btn } from "../../components/ui/Btn";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3005/api/v1";

export function SupGuardias() {
  const { token } = useAuth();
  const [guardias, setGuardias] = useState([]);
  const [instalaciones, setInstalaciones] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({
    usuario_id: "",
    instalacion_id: "",
    fecha: new Date().toISOString().split("T")[0],
    hora_inicio: "06:00",
    hora_fin: "14:00",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${API_BASE}/usuarios?rol=pauta`, { headers })
      .then(r => r.json())
      .then(d => {
        const lista = Array.isArray(d) ? d : d.data || [];
        fetch(`${API_BASE}/usuarios?rol=libre`, { headers })
          .then(r => r.json())
          .then(d2 => {
            const lista2 = Array.isArray(d2) ? d2 : d2.data || [];
            setGuardias([...lista, ...lista2]);
          });
      })
      .catch(() => setGuardias([]));

    fetch(`${API_BASE}/instalaciones`, { headers })
      .then(r => r.json())
      .then(d => setInstalaciones(Array.isArray(d) ? d : d.data || []))
      .catch(() => setInstalaciones([]));
  }, [token]);

  const crearTurno = async () => {
    if (!form.usuario_id || !form.instalacion_id || !form.fecha) {
      setMsg("Completa todos los campos");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`${API_BASE}/turnos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear turno");
      setMsg("Turno creado exitosamente");
      setMostrarForm(false);
      setForm({ usuario_id: "", instalacion_id: "", fecha: new Date().toISOString().split("T")[0], hora_inicio: "06:00", hora_fin: "14:00" });
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.bgCard, color: T.text, fontSize: 13, marginBottom: 10, boxSizing: "border-box",
  };

  return (
    <div>
      <SectionHeader
        title="Guardias"
        sub="Personal asignado a tus instalaciones"
        action={{ label: "+ Crear Turno", onClick: () => { setMostrarForm(v => !v); setMsg(""); } }}
      />

      {mostrarForm && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Nuevo Turno</div>

          <div style={{ fontSize: 11, color: T.textMut, marginBottom: 4 }}>GUARDIA</div>
          <select style={inputStyle} value={form.usuario_id} onChange={e => setForm(f => ({ ...f, usuario_id: e.target.value }))}>
            <option value="">Seleccionar guardia...</option>
            {guardias.map(g => <option key={g.id} value={g.id}>{g.nombre} ({g.rol})</option>)}
          </select>

          <div style={{ fontSize: 11, color: T.textMut, marginBottom: 4 }}>INSTALACIÓN</div>
          <select style={inputStyle} value={form.instalacion_id} onChange={e => setForm(f => ({ ...f, instalacion_id: e.target.value }))}>
            <option value="">Seleccionar instalación...</option>
            {instalaciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>

          <div style={{ fontSize: 11, color: T.textMut, marginBottom: 4 }}>FECHA</div>
          <input type="date" style={inputStyle} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textMut, marginBottom: 4 }}>HORA INICIO</div>
              <input type="time" style={inputStyle} value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMut, marginBottom: 4 }}>HORA FIN</div>
              <input type="time" style={inputStyle} value={form.hora_fin} onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))} />
            </div>
          </div>

          {msg && (
            <div style={{ fontSize: 12, color: msg.includes("exitosa") ? T.accent : T.red, marginBottom: 8 }}>
              {msg}
            </div>
          )}

          <Btn onClick={crearTurno} disabled={loading} full>
            {loading ? "Creando..." : "Confirmar Turno"}
          </Btn>
        </div>
      )}

      {guardias.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 20 }}>Cargando guardias...</div>
      ) : guardias.map((g, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 12, marginBottom: 5, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{g.nombre}</div>
            <div style={{ fontSize: 11, color: T.textMut }}>GGSS {g.rol === "pauta" ? "Pauta" : "Libre"}</div>
          </div>
          <Badge color={g.estado === "activo" ? "accent" : "red"}>{g.estado}</Badge>
        </div>
      ))}
    </div>
  );
}
