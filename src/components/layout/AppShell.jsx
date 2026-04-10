import { useState } from "react";
import { T, ROLES } from "../../theme/theme";

// Pauta screens
import { PautaTurno } from "../../screens/pauta/PautaTurno";
import { PautaNovedades } from "../../screens/pauta/PautaNovedades";
import { PautaHistorial } from "../../screens/pauta/PautaHistorial";
import { PautaAlertas } from "../../screens/pauta/PautaAlertas";

// Libre screens
import { LibreTurnos } from "../../screens/libre/LibreTurnos";
import { LibreSolicitudes } from "../../screens/libre/LibreSolicitudes";
import { LibreDocs } from "../../screens/libre/LibreDocs";

// Supervisor screens
import { SupDashboard } from "../../screens/supervisor/SupDashboard";
import { SupNovedades } from "../../screens/supervisor/SupNovedades";
import { SupSolicitudes } from "../../screens/supervisor/SupSolicitudes";
import { SupGuardias } from "../../screens/supervisor/SupGuardias";
import { SupReportes } from "../../screens/supervisor/SupReportes";

// Admin screens
import { AdminPanel } from "../../screens/admin/AdminPanel";
import { AdminUsuarios } from "../../screens/admin/AdminUsuarios";
import { AdminInstalaciones } from "../../screens/admin/AdminInstalaciones";
import { AdminTurnos } from "../../screens/admin/AdminTurnos";

const SCREEN_MAP = {
  pauta: { turno: PautaTurno, novedades: PautaNovedades, historial: PautaHistorial, alertas: PautaAlertas },
  libre: { turnos: LibreTurnos, solicitudes: LibreSolicitudes, docs: LibreDocs },
  supervisor: { dashboard: SupDashboard, novedades: SupNovedades, solicitudes: SupSolicitudes, guardias: SupGuardias, reportes: SupReportes },
  admin: { panel: AdminPanel, usuarios: AdminUsuarios, instalaciones: AdminInstalaciones, turnos: AdminTurnos },
};

export function AppShell({ user, token, onLogout }) {
  const role = ROLES[user.rol];
  const [activeSection, setActiveSection] = useState(role?.sections?.[0]?.id || "");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const screens = SCREEN_MAP[user.rol] || {};
  const ActiveScreen = screens[activeSection];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Outfit', sans-serif", color: T.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* TopBar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: `${T.bgCard}EE`, backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setSidebarOpen(v => !v)} style={{ background: "none", border: "none", color: T.text, fontSize: 20, cursor: "pointer" }}>☰</button>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${T.accent}, ${T.accentDim})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🛡️</div>
          <span style={{ fontWeight: 800, fontSize: 15 }}>Geo Constanza</span>
          <span style={{ fontSize: 11, color: role?.color, fontWeight: 700 }}>{role?.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent }} />
          <span style={{ fontSize: 13, color: T.textSec }}>{user.nombre}</span>
        </div>
      </div>

      {/* Nav Tabs */}
      <div style={{
        display: "flex", gap: 2, padding: "8px 16px",
        borderBottom: `1px solid ${T.border}`, overflowX: "auto",
        background: T.bgCard,
      }}>
        {role?.sections?.map(s => (
          <button
            key={s.id}
            onClick={() => { setActiveSection(s.id); setSidebarOpen(false); }}
            style={{
              background: activeSection === s.id ? T.accentGhost : "none",
              border: activeSection === s.id ? `1px solid ${T.accent}33` : "1px solid transparent",
              borderRadius: 8, padding: "6px 14px", cursor: "pointer",
              color: activeSection === s.id ? T.accent : T.textMut,
              fontSize: 13, fontWeight: activeSection === s.id ? 700 : 400,
              fontFamily: "inherit", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {s.icon} {s.label}
            {s.badge && (
              <span style={{
                background: T.red, color: "#fff", fontSize: 9, fontWeight: 700,
                borderRadius: "50%", width: 16, height: 16, display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>{s.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
          <div onClick={() => setSidebarOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
          <div style={{
            position: "relative", zIndex: 1, width: 280,
            background: T.bgCard, borderRight: `1px solid ${T.border}`,
            padding: 20, display: "flex", flexDirection: "column", gap: 16,
            overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 16, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${role?.color || T.accent}, ${T.accentDim})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                {role?.icon}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{user.nombre}</div>
                <div style={{ fontSize: 11, color: role?.color, fontWeight: 700 }}>{role?.label}</div>
                <div style={{ fontSize: 10, color: T.textMut }}>RUT: {user.rut ? `•••••${user.rut.slice(-2)}` : "—"}</div>
              </div>
            </div>

            <div style={{ fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: -8 }}>Navegación</div>
            {role?.sections?.map(s => (
              <button
                key={s.id}
                onClick={() => { setActiveSection(s.id); setSidebarOpen(false); }}
                style={{
                  background: activeSection === s.id ? T.accentGhost : "none",
                  border: activeSection === s.id ? `1px solid ${T.accent}33` : "1px solid transparent",
                  borderRadius: 10, padding: "10px 14px", cursor: "pointer",
                  color: activeSection === s.id ? T.accent : T.text,
                  fontSize: 13, fontWeight: activeSection === s.id ? 700 : 400,
                  fontFamily: "inherit", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 10,
                }}
              >
                <span>{s.icon}</span>
                <span style={{ flex: 1 }}>{s.label}</span>
                {s.badge && (
                  <span style={{ background: T.red, color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.badge}</span>
                )}
              </button>
            ))}

            <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10, color: T.textMut, marginBottom: 8 }}>
                Sesión Activa · Token JWT · 2 hrs<br />
                ✅ 2FA verificado
              </div>
              <button
                onClick={onLogout}
                style={{
                  width: "100%", padding: "10px", borderRadius: 10,
                  border: `1px solid ${T.red}44`, background: T.redGhost,
                  color: T.red, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ padding: 16, maxWidth: 700, margin: "0 auto" }}>
        {ActiveScreen ? <ActiveScreen user={user} token={token} /> : (
          <div style={{ textAlign: "center", padding: 40, color: T.textMut }}>Selecciona una sección</div>
        )}
      </div>
    </div>
  );
}
