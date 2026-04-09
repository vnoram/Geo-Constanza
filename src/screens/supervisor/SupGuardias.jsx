import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function SupGuardias() {
  return (
    <div>
      <SectionHeader title="Guardias" sub="Personal asignado a tus instalaciones" />
      {[
        { n: "V. Norambuena", rol: "Pauta", st: "Activo" },
        { n: "M. López", rol: "Pauta", st: "Activo" },
        { n: "J. García", rol: "Libre", st: "Activo" },
        { n: "R. Soto", rol: "Pauta", st: "Activo" },
        { n: "C. Muñoz", rol: "Pauta", st: "Ausente" },
      ].map((g, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 12, marginBottom: 5, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{g.n}</div>
            <div style={{ fontSize: 11, color: T.textMut }}>GGSS {g.rol}</div>
          </div>
          <Badge color={g.st === "Activo" ? "accent" : "red"}>{g.st}</Badge>
        </div>
      ))}
    </div>
  );
}
