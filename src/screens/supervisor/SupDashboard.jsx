import { T } from "../../theme/theme";
import { KPI } from "../../components/ui/KPI";
import { SubHeader } from "../../components/ui/SubHeader";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function SupDashboard() {
  return (
    <div>
      <SectionHeader title="Dashboard en Vivo" sub="Estado operacional en tiempo real" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <KPI label="Activos" value="4" sub="de 5 esperados" accent={T.accent} />
        <KPI label="Ausentes" value="1" sub="C. Muñoz" accent={T.red} />
        <KPI label="Incidentes" value="2" sub="1 crítico" accent={T.yellow} />
        <KPI label="Puntualidad" value="80%" sub="hoy" accent={T.accent} />
      </div>

      <SubHeader title="GGSS en Pauta Ahora" />
      {[
        { n: "V. Norambuena", inst: "CC Arauco", entrada: "06:02", chk: "08:15", st: "activo" },
        { n: "M. López", inst: "CC Arauco", entrada: "06:10", chk: "07:45", st: "alerta" },
        { n: "J. García", inst: "Cond. Los Álamos", entrada: "06:00", chk: "08:20", st: "activo" },
        { n: "R. Soto", inst: "Edif. Atlas", entrada: "06:15", chk: "08:10", st: "activo" },
        { n: "C. Muñoz", inst: "Faena Norte", entrada: "—", chk: "—", st: "ausente" },
      ].map((g, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          borderLeft: `3px solid ${g.st === "activo" ? T.accent : g.st === "alerta" ? T.yellow : T.red}`,
          padding: 12, marginBottom: 5, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{g.n}</div>
            <div style={{ fontSize: 11, color: T.textMut }}>{g.inst}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: T.textMut }}>Entrada: {g.entrada}</div>
            <div style={{ fontSize: 10, color: T.textMut }}>Ult. chk: {g.chk}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
