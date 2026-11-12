import { useRef } from "react";
import { T } from "../../theme/theme";

const MAX_MB = 5;

/** Selector de archivo (imagen JPG/PNG/WebP o PDF, hasta 5 MB) con el estilo de la app. */
export function SubirArchivo({ label, archivo, onChange, onError }) {
  const ref = useRef(null);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textSec, marginBottom: 6 }}>{label}</label>}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => {
        const f = e.target.files?.[0] ?? null;
        if (f && f.size > MAX_MB * 1024 * 1024) {
          onError?.(`El archivo supera los ${MAX_MB} MB.`); e.target.value = ""; onChange(null); return;
        }
        onError?.(""); onChange(f);
      }} style={{ color: T.textSec, fontSize: 12, maxWidth: "100%" }} />
      <div style={{ fontSize: 11, color: T.textMut, marginTop: 4 }}>Imagen (JPG, PNG, WebP) o PDF, hasta {MAX_MB} MB.</div>
      {archivo && <button type="button" onClick={() => { onChange(null); if (ref.current) ref.current.value = ""; }}
        style={{ background: "none", border: "none", color: T.focusText, fontSize: 11, cursor: "pointer", padding: 0, marginTop: 4 }}>Quitar archivo</button>}
    </div>
  );
}
