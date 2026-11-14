import { KPI } from "../../components/ui/KPI";
import { useCallback, useEffect, useState } from "react";
import { leerSesion } from "../../services/almacenSesion";
import { api } from "../../services/api";
import { API_URL as API_BASE } from "../../config/api";
import { FONT, T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Input } from "../../components/ui/Input";
import { Icon } from "../../components/ui/Icon";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SubirArchivo } from "../../components/ui/SubirArchivo";

const TIPOS = { contrato: "Contrato", liquidacion: "Liquidación", os10: "Certificado OS-10", anexo: "Anexo", otro: "Otro" };
const tarjeta = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 14 };
const etiqueta = { fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 };
const selectEstilo = { background: T.bgInput, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "10px 12px", fontSize: 14, minHeight: 42, width: "100%" };

/** Administración publica documentos para un guardia (contrato, liquidaciones, anexos...). */
export function AdminDocumentos() {
  const [guardias, setGuardias] = useState([]);
  const [usuarioId, setUsuarioId] = useState("");
  const [tipo, setTipo] = useState("contrato");
  const [nombre, setNombre] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api.get("/usuarios?rol=ggss&limit=200")
      .then((a) => setGuardias([...(a.data ?? [])].sort((x, y) => x.nombre.localeCompare(y.nombre))))
      .catch(err => setError(err.message));
  }, []);

  const cargar = useCallback(async () => {
    if (!usuarioId) { setDocs([]); return; }
    try { setDocs(await api.get(`/documentos?usuario_id=${encodeURIComponent(usuarioId)}`)); }
    catch (err) { setError(err.message); }
  }, [usuarioId]);
  useEffect(() => { cargar(); }, [cargar]);

  const subir = async () => {
    setError(""); setAviso(""); setOcupado(true);
    try {
      const form = new FormData();
      form.append("usuario_id", usuarioId);
      form.append("tipo", tipo);
      if (nombre.trim()) form.append("nombre", nombre.trim());
      form.append("archivo", archivo);
      const res = await fetch(`${API_BASE}/documentos`, {
        method: "POST", headers: { Authorization: `Bearer ${leerSesion("gc_token")}` }, body: form,
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error || `Error ${res.status}`);
      setArchivo(null); setNombre("");
      setAviso("Documento publicado. El guardia ya puede descargarlo.");
      await cargar();
    } catch (err) { setError(err.message); }
    finally { setOcupado(false); }
  };

  return (
    <div>
      <SectionHeader title="Documentos del personal" sub="Publica contratos, liquidaciones y anexos para cada guardia" />
      <div className="gc-dashboard-kpis">
        <KPI label="Guardias" value={guardias.length} sub="disponibles para seleccionar" />
        <KPI label="Documentos" value={usuarioId ? docs.length : "—"} sub="del guardia seleccionado" accent={T.accent} />
        <KPI label="Tipos de documento" value={usuarioId ? new Set(docs.map(d => d.tipo)).size : "—"} sub="entre los archivos listados" />
      </div>
      <div style={{ ...tarjeta, marginBottom: 20, maxWidth: 560 }}>
        <div style={etiqueta}>Nuevo documento</div>
        <label style={{ display: "block", fontSize: 12, color: T.textSec, marginBottom: 6 }}>Guardia</label>
        <select aria-label="Guardia" value={usuarioId} onChange={e => setUsuarioId(e.target.value)} style={{ ...selectEstilo, marginBottom: 16 }}>
          <option value="">Selecciona un guardia</option>
          {guardias.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
        </select>
        <label style={{ display: "block", fontSize: 12, color: T.textSec, marginBottom: 6 }}>Tipo</label>
        <select aria-label="Tipo" value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...selectEstilo, marginBottom: 16 }}>
          {Object.entries(TIPOS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <Input label="Nombre del documento (opcional)" value={nombre} onChange={setNombre} maxLength={100} placeholder="Ej. Liquidación marzo 2026" />
        <SubirArchivo label="Archivo" archivo={archivo} onChange={setArchivo} onError={setError} />
        <Btn onClick={subir} loading={ocupado} disabled={!archivo || !usuarioId} full>Publicar documento</Btn>
        {aviso && <div role="status" style={{ fontSize: 12, color: T.accent, marginTop: 10 }}>{aviso}</div>}
        {error && <div role="alert" style={{ fontSize: 12, color: T.alert, marginTop: 10 }}>{error}</div>}
      </div>

      {usuarioId && <div style={etiqueta}>Documentos del guardia</div>}
      {usuarioId && docs.length === 0 && <div style={{ ...tarjeta, color: T.textMut, fontSize: 13, maxWidth: 560 }}>Este guardia aún no tiene documentos.</div>}
      <div className="gc-dashboard-grid">
        {docs.map(d => (
          <div key={d.id} className="gc-dashboard-card" style={{ ...tarjeta, borderLeft: `3px solid ${d.url_firmada ? T.accent : T.border}` }}>
            <div className="admin-list-row__main">
              <div style={{ fontSize: 13, fontWeight: 600 }}><Icon name="file-text" size={16} /> {d.nombre}</div>
              <div style={{ fontSize: 11, color: T.textSec, fontFamily: FONT.mono, background: T.bgInput, borderRadius: T.radius, padding: 8, marginTop: 6 }}>{TIPOS[d.tipo] ?? d.tipo} · {new Date(d.created_at).toLocaleDateString("es-CL")}{d.autor?.nombre ? ` · ${d.autor.nombre}` : ""}</div>
          </div>
          {d.url_firmada && <a href={d.url_firmada} target="_blank" rel="noreferrer" className="touch-target" style={{ color: T.focusText, fontSize: 12, fontWeight: 600, marginTop: "auto", display: "inline-flex", alignItems: "center", alignSelf: "start" }}>Abrir →</a>}
        </div>
      ))}
      </div>
    </div>
  );
}
