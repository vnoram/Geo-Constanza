import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../components/ui/Icon";
import { T } from "../../theme/theme";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Btn } from "../../components/ui/Btn";
import { SubirArchivo } from "../../components/ui/SubirArchivo";
import { api } from "../../services/api";
import { API_URL as API_BASE } from "../../config/api";

const ICONOS = { contrato: "file-text", liquidacion: "banknote", os10: "graduation-cap", anexo: "paperclip", otro: "file-text" };
const tarjeta = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 };
const etiqueta = { fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 };
const fecha = (iso) => new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });

export function LibreDocs() {
  const [docs, setDocs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try { setDocs(await api.get("/documentos")); }
    catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const subir = async () => {
    setError(""); setAviso(""); setOcupado(true);
    try {
      const form = new FormData();
      form.append("nombre", "Certificado OS-10");
      form.append("archivo", archivo);
      const res = await fetch(`${API_BASE}/documentos`, {
        method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("gc_token")}` }, body: form,
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error || `Error ${res.status}`);
      setArchivo(null);
      setAviso("Certificado OS-10 subido correctamente.");
      await cargar();
    } catch (err) { setError(err.message); }
    finally { setOcupado(false); }
  };

  const tieneOs10 = docs.some(d => d.tipo === "os10");
  return (
    <div className="guard-screen">
      <SectionHeader title="Documentos" sub="Tu documentación personal" />

      <div style={{ ...tarjeta, marginBottom: 20 }}>
        <div style={etiqueta}>Certificado OS-10</div>
        <p style={{ fontSize: 12, color: T.textSec, margin: "0 0 10px" }}>
          {tieneOs10 ? "Ya tienes un certificado cargado. Si renovaste el tuyo, sube el nuevo." : "Aún no has subido tu certificado OS-10. Súbelo para mantener tu documentación al día."}
        </p>
        <SubirArchivo archivo={archivo} onChange={setArchivo} onError={setError} />
        <Btn onClick={subir} loading={ocupado} disabled={!archivo} full>Subir certificado</Btn>
        {aviso && <div role="status" style={{ fontSize: 12, color: T.accent, marginTop: 10 }}>{aviso}</div>}
        {error && <div role="alert" style={{ fontSize: 12, color: T.alert, marginTop: 10 }}>{error}</div>}
      </div>

      <div style={etiqueta}>Mis documentos</div>
      {cargando ? (
        <div style={{ textAlign: "center", padding: 24, fontSize: 13, color: T.textMut }}>Cargando documentos...</div>
      ) : docs.length === 0 ? (
        <div style={{ ...tarjeta, textAlign: "center", padding: 24, color: T.textMut, fontSize: 13 }}>
          <Icon name="folder" size={16} /> Aún no hay documentos. Tu empresa publicará aquí tu contrato, liquidaciones y anexos.
        </div>
      ) : docs.map(d => (
        <div className="guard-list-row" key={d.id} style={{ ...tarjeta, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div className="guard-list-row__main" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name={ICONOS[d.tipo] ?? "file-text"} size={18} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{d.nombre}</div>
              <div style={{ fontSize: 11, color: T.textMut }}>{fecha(d.created_at)}{d.autor?.nombre ? ` · subido por ${d.autor.nombre}` : ""}</div>
            </div>
          </div>
          {d.url_firmada
            ? <a href={d.url_firmada} target="_blank" rel="noreferrer" style={{ color: T.accent, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>Descargar →</a>
            : <span style={{ color: T.textMut, fontSize: 11 }}>No disponible</span>}
        </div>
      ))}
    </div>
  );
}
