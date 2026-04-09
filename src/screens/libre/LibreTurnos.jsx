import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function LibreTurnos() {
  const turnos = [
    { fecha: "10 Abr", inicio: "14:00", fin: "22:00", inst: "Edificio Corp. Atlas", estado: "Confirmado" },
    { fecha: "12 Abr", inicio: "22:00", fin: "06:00", inst: "Condominio Los Álamos", estado: "Pendiente" },
    { fecha: "15 Abr", inicio: "06:00", fin: "14:00", inst: "Centro Comercial Arauco", estado: "Confirmado" },
    { fecha: "18 Abr", inicio: "14:00", fin: "22:00", inst: "Faena Industrial Norte", estado: "Confirmado" },
  ];
  return (
    <div>
      <SectionHeader title="Mis Turnos" sub="Próximos 60 días" />
      {turnos.map((t, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t.fecha}</div>
            <div style={{ fontSize: 12, color: T.textSec }}>{t.inicio} — {t.fin}</div>
            <div style={{ fontSize: 11, color: T.textMut, marginTop: 2 }}>{t.inst}</div>
          </div>
          <Badge color={t.estado === "Confirmado" ? "accent" : "yellow"}>{t.estado}</Badge>
        </div>
      ))}
    </div>
  );
}
