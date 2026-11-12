import { useCallback, useEffect, useState } from "react";
import { leerSesion } from "../../services/almacenSesion";
import { Icon } from "../../components/ui/Icon";
import { T } from "../../theme/theme";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";
import { API_URL as API_BASE } from "../../config/api";

const ICONOS = { contrato: "file-text", liquidacion: "banknote", os10: "graduation-cap", anexo: "paperclip", otro: "file-text" };
const tarjeta = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 };
const etiqueta = { fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 };
const fecha = (iso) => new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });

export function LibreDocs() {
  const [docs, setDocs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try { setDocs(await api.get("/documentos")); }
    catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const subir = async (archivo) => {
    if (!archivo) return;
    setError(""); setAviso("");
    if (archivo.size > 5 * 1024 * 1024) { setError("El archivo supera los 5 MB."); return; }
    setOcupado(true);
    try {
      const form = new FormData();
      form.append("nombre", "Certificado OS-10");
      form.append("archivo", archivo);
      const res = await fetch(`${API_BASE}/documentos`, {
        method: "POST", headers: { Authorization: `Bearer ${leerSesion("gc_token")}` }, body: form,
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error || `Error ${res.status}`);
      setAviso("Certificado OS-10 subido correctamente.");
      await cargar();
    } catch (err) { setError(err.message); }
    finally { setOcupado(false); }
  };

  const BASE = [["contrato", "Contrato"], ["liquidacion", "Liquidación"], ["os10", "Certificado OS-10"], ["anexo", "Anexo de contrato"]];
  const filas = [
    ...BASE.flatMap(([tipo, titulo]) => {
      const propios = docs.filter(d => d.tipo === tipo);
      return propios.length ? propios.map(d => ({ tipo, titulo: d.nombre, doc: d })) : [{ tipo, titulo }];
    }),
    ...docs.filter(d => !BASE.some(([t]) => t === d.tipo)).map(d => ({ tipo: d.tipo, titulo: d.nombre, doc: d })),
  ];

  return (
    <div className="guard-screen">
      <SectionHeader title="Documentos" sub="Tu documentación personal" />
      {cargando ? (
        <div style={{ textAlign: "center", padding: 24, fontSize: 13, color: T.textMut }}>Cargando documentos...</div>
      ) : filas.map((f, i) => (
        <div className="guard-list-row" key={f.doc?.id ?? `${f.tipo}-${i}`} style={{ ...tarjeta, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div className="guard-list-row__main" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name={ICONOS[f.tipo] ?? "file-text"} size={18} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{f.titulo}</div>
              <div style={{ fontSize: 11, color: f.doc ? T.accent : T.textMut }}>
                {f.doc ? `Disponible · ${fecha(f.doc.created_at)}` : "Pendiente"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {f.doc?.url_firmada && <a href={f.doc.url_firmada} target="_blank" rel="noreferrer" style={{ color: T.accent, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>Descargar →</a>}
            {f.tipo === "os10" && (
              <label style={{ color: T.accent, fontSize: 11, fontWeight: 600, cursor: ocupado ? "default" : "pointer", opacity: ocupado ? 0.5 : 1 }}>
                {ocupado ? "Subiendo..." : f.doc ? "Reemplazar" : "Subir →"}
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={ocupado} style={{ display: "none" }}
                  onChange={e => { subir(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>
      ))}
      {aviso && <div role="status" style={{ fontSize: 12, color: T.accent, marginTop: 10 }}>{aviso}</div>}
      {error && <div role="alert" style={{ fontSize: 12, color: T.alert, marginTop: 10 }}>{error}</div>}
    </div>
  );
}
