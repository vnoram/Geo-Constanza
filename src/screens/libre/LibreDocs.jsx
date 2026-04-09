import { T } from "../../theme/theme";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function LibreDocs() {
  const docs = ["Contrato Vigente", "Liquidación Marzo 2026", "Certificado OS-10", "Anexo Contrato Ene 2026"];
  return (
    <div>
      <SectionHeader title="Documentos" sub="Tu documentación personal" />
      {docs.map((d, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>{["📄", "💰", "🎓", "📎"][i]}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{d}</span>
          </div>
          <span style={{ color: T.accent, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Descargar →</span>
        </div>
      ))}
    </div>
  );
}
