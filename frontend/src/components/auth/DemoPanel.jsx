import { T } from "../../theme/theme";

const DEMO_USERS = [
  { rut: "20570418-3", rol: "GGSS Pauta",   name: "V. Norambuena" },
  { rut: "19234567-8", rol: "GGSS Libre",   name: "M. López"       },
  { rut: "15678901-2", rol: "Supervisor",   name: "A. Martínez"    },
  { rut: "12812223-0", rol: "Admin",        name: "C. González"    },
];

export function DemoPanel({ onSelect }) {
  return (
    <div style={{
      marginTop: 12, background: T.accentGhost, border: `1px solid ${T.accent}22`,
      borderRadius: 12, padding: 14, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{
        color: T.textSec, marginBottom: 8, fontFamily: "'Outfit', sans-serif",
        fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5,
      }}>
        Contraseña para todos: geo2026
      </div>
      {DEMO_USERS.map((d, i) => (
        <div
          key={d.rut}
          onClick={() => onSelect(d.rut, "geo2026")}
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "6px 8px", borderRadius: 6, cursor: "pointer",
            marginBottom: i < DEMO_USERS.length - 1 ? 4 : 0, transition: "background 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = T.accentGhost}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <span style={{ color: T.accent }}>{d.rut}</span>
          <span style={{ color: T.textMut, fontSize: 10 }}>{d.rol}</span>
        </div>
      ))}
    </div>
  );
}
