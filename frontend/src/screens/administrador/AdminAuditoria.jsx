import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function AdminAuditoria() {
  const logs = [
    { accion: "LOGIN", usuario: "A. Martínez", detalle: "Supervisor · 2FA OK", hora: "06:00", ip: "190.44.x.x" },
    { accion: "CREAR_TURNO", usuario: "C. González", detalle: "Turno 10 Abr · V. Norambuena", hora: "08:30", ip: "192.168.x.x" },
    { accion: "APROBAR_SOL", usuario: "A. Martínez", detalle: "Vacaciones · R. Soto", hora: "09:15", ip: "190.44.x.x" },
    { accion: "EDITAR_INST", usuario: "C. González", detalle: "Faena Norte · criticidad: Media→Alta", hora: "10:00", ip: "192.168.x.x" },
  ];
  return (
    <div>
      <SectionHeader title="Auditoría" sub="Log de cambios del sistema" />
      {logs.map((l, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 12, marginBottom: 5,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Badge color="accent">{l.accion}</Badge>
            <span style={{ fontSize: 10, color: T.textMut, fontFamily: "'JetBrains Mono', monospace" }}>{l.hora}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{l.usuario}</div>
          <div style={{ fontSize: 11, color: T.textMut }}>{l.detalle} · IP: {l.ip}</div>
        </div>
      ))}
    </div>
  );
}
