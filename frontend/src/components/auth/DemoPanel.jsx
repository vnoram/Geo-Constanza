import { T, FONT } from "../../theme/theme";

// Cuentas de la demo local (seed). Dos empresas separadas para comprobar el aislamiento.
const DEMO_USERS = [
  { rut: "10000001-6", rol: "Plataforma (super admin)",       name: "Plataforma" },
  { rut: "12812223-0", rol: "Alfa · Admin (Gestión)",         name: "C. González" },
  { rut: "11111111-1", rol: "Alfa · Central (Monitoreo)",     name: "Op. Central" },
  { rut: "15678901-2", rol: "Alfa · Supervisor",              name: "A. Martínez" },
  { rut: "20570418-3", rol: "Alfa · GGSS Pauta",              name: "V. Norambuena" },
  { rut: "19234567-8", rol: "Alfa · GGSS Libre",              name: "M. López" },
  { rut: "21000001-1", rol: "Beta · Admin (Gestión)",         name: "Admin Beta" },
  { rut: "21000002-K", rol: "Beta · Supervisor",              name: "C. Ruiz" },
  { rut: "21000003-8", rol: "Beta · GGSS Pauta",              name: "R. Vera" },
];

export function DemoPanel({ onSelect }) {
  return (
    <div style={{
      marginTop: 10, border: `1px solid ${T.border}`, borderRadius: T.radius,
      background: T.bgInput, fontFamily: FONT.mono, fontSize: 12,
    }}>
      <div style={{ padding: "8px 12px", color: T.textMut, borderBottom: `1px solid ${T.border}`, fontFamily: FONT.ui, fontSize: 11 }}>
        Contraseña común: geo2026
      </div>
      {DEMO_USERS.map((d, i) => (
        <button
          key={d.rut}
          type="button"
          onClick={() => onSelect(d.rut, "geo2026")}
          className="demo-row touch-target"
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            width: "100%", minHeight: 38, padding: "0 12px", background: "transparent", border: "none",
            borderBottom: i < DEMO_USERS.length - 1 ? `1px solid ${T.border}` : "none",
            color: T.text, cursor: "pointer", textAlign: "left", fontFamily: FONT.mono, fontSize: 12,
          }}
        >
          <span>{d.rut}</span>
          <span style={{ color: T.textSec, fontFamily: FONT.ui, fontSize: 11 }}>{d.rol}</span>
        </button>
      ))}
    </div>
  );
}
