import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function AdminInstalaciones() {
  const insts = [
    { n: "Centro Comercial Arauco", tipo: "Comercial", criticidad: "Alta", tablet: true },
    { n: "Edificio Corp. Atlas", tipo: "Corporativo", criticidad: "Media", tablet: true },
    { n: "Condominio Los Álamos", tipo: "Residencial", criticidad: "Baja", tablet: true },
    { n: "Faena Industrial Norte", tipo: "Industrial", criticidad: "Alta", tablet: false },
  ];
  return (
    <div>
      <SectionHeader title="Instalaciones" sub="Recintos registrados en el sistema" action={{ label: "+ Nueva", onClick: () => {} }} />
      {insts.map((inst, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, marginBottom: 6,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{inst.n}</span>
            <Badge color={inst.criticidad === "Alta" ? "red" : inst.criticidad === "Media" ? "yellow" : "accent"}>{inst.criticidad}</Badge>
          </div>
          <div style={{ fontSize: 12, color: T.textMut }}>
            {inst.tipo} · Tablet: {inst.tablet ? "✅ Instalada" : "❌ Pendiente"}
          </div>
        </div>
      ))}
    </div>
  );
}
