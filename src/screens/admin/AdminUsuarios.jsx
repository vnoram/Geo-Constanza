import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function AdminUsuarios() {
  const users = [
    { n: "V. Norambuena", rol: "GGSS Pauta", st: "Activo" },
    { n: "M. López", rol: "GGSS Pauta", st: "Activo" },
    { n: "J. García", rol: "GGSS Libre", st: "Activo" },
    { n: "A. Martínez", rol: "Supervisor", st: "Activo" },
    { n: "C. González", rol: "Admin", st: "Activo" },
    { n: "P. Rodríguez", rol: "GGSS Pauta", st: "Inactivo" },
  ];
  return (
    <div>
      <SectionHeader title="Usuarios" sub="Gestión de personal del sistema" action={{ label: "+ Crear", onClick: () => {} }} />
      {users.map((u, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 12, marginBottom: 5, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{u.n}</div>
            <div style={{ fontSize: 11, color: T.textMut }}>{u.rol}</div>
          </div>
          <Badge color={u.st === "Activo" ? "accent" : "red"}>{u.st}</Badge>
        </div>
      ))}
    </div>
  );
}
