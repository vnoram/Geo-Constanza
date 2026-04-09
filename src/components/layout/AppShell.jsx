import { useState, useEffect } from "react";
import { T, ROLES } from "../../theme/theme";
import { api } from "../../services/api";
import { Placeholder } from "../ui/Placeholder";

// ─── Pauta ───
import { PautaTurno } from "../../screens/pauta/PautaTurno";
import { PautaNovedades } from "../../screens/pauta/PautaNovedades";
import { PautaHistorial } from "../../screens/pauta/PautaHistorial";
import { PautaAlertas } from "../../screens/pauta/PautaAlertas";

// ─── Libre ───
import { LibreTurnos } from "../../screens/libre/LibreTurnos";
import { LibreSolicitudes } from "../../screens/libre/LibreSolicitudes";
import { LibreDocs } from "../../screens/libre/LibreDocs";

// ─── Supervisor ───
import { SupDashboard } from "../../screens/supervisor/SupDashboard";
import { SupNovedades } from "../../screens/supervisor/SupNovedades";
import { SupSolicitudes } from "../../screens/supervisor/SupSolicitudes";
import { SupGuardias } from "../../screens/supervisor/SupGuardias";
import { SupReportes } from "../../screens/supervisor/SupReportes";

// ─── Admin ───
import { AdminPanel } from "../../screens/admin/AdminPanel";
import { AdminUsuarios } from "../../screens/admin/AdminUsuarios";
import { AdminInstalaciones } from "../../screens/admin/AdminInstalaciones";
import { AdminTurnos } from "../../screens/admin/AdminTurnos";
import { AdminAuditoria } from "../../screens/admin/AdminAuditoria";

function RoleContent({ user, rol, section }) {
  const allowed = ROLES[rol]?.sections.map(s => s.id) || [];
  if (!allowed.includes(section)) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
        <div style={{ color: T.red, fontWeight: 700, fontSize: 16 }}>Acceso Denegado</div>
        <div style={{ color: T.textMut, fontSize: 13, marginTop: 6 }}>
          Tu rol ({ROLES[rol]?.label}) no tiene permisos para esta sección.
        </div>
      </div>
    );
  }

  if (rol === "pauta") {
    if (section === "turno") return <PautaTurno user={user} />;
    if (section === "novedades") return <PautaNovedades user={user} />;
    if (section === "historial") return <PautaHistorial />;
    if (section === "alertas") return <PautaAlertas />;
  }
  if (rol === "libre") {
    if (section === "turnos") return <LibreTurnos />;
    if (section === "solicitudes") return <LibreSolicitudes />;
    if (section === "docs") return <LibreDocs />;
  }
  if (rol === "supervisor") {
    if (section === "dashboard") return <SupDashboard />;
    if (section === "novedades") return <SupNovedades />;
    if (section === "solicitudes") return <SupSolicitudes />;
    if (section === "guardias") return <SupGuardias />;
    if (section === "reportes") return <SupReportes />;
  }
  if (rol === "admin") {
    if (section === "panel") return <AdminPanel />;
    if (section === "usuarios") return <AdminUsuarios />;
    if (section === "instalaciones") return <AdminInstalaciones />;
    if (section === "turnos") return <AdminTurnos />;
    if (section === "auditoria") return <AdminAuditoria />;
  }
  return <Placeholder section={section} />;
}

export function AppShell({ user, token, onLogout }) {
  const role = ROLES[user.rol];
  const [activeSection, setActiveSection] = useState(role.sections[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    api.getProfile(token).catch(() => {});
  }, [token]);

  return (
    <div style={{
      minHeight: "100vh", background: T.bg,
      fontFamily: "'Outfit', sans-serif", color: T.text,
      display: "flex", flexDirection: "column",
    }}>
      {/* ─── TOP BAR ─── */}
      <header style={{
        background: `${T.bgCard}EE`, backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.border}`,
        padding: "0 16px", height: 56, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: "none", border: "none", color: T.textSec,
            fontSize: 20, cursor: "pointer", padding: 4,
          }}>☰</button>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: `linear-gradient(135deg, ${role.color}33, ${role.color}11)`,
            border: `1px solid ${role.color}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>{role.icon}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>Geo Constanza</div>
            <div style={{ fontSize: 10, color: role.color, fontWeight: 600 }}>{role.label}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent, boxShadow: `0 0 8px ${T.accent}` }} />
          <span style={{ fontSize: 11, color: T.textMut, fontWeight: 500 }}>{user.nombre.split(" ")[0]}</span>
        </div>
      </header>

      {/* ─── NAV TABS ─── */}
      <nav style={{
        display: "flex", gap: 2, padding: "8px 10px",
        overflowX: "auto", background: T.bgCard,
        borderBottom: `1px solid ${T.border}`,
        WebkitOverflowScrolling: "touch",
      }}>
        {role.sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            background: activeSection === s.id ? `${role.color}15` : "transparent",
            border: `1px solid ${activeSection === s.id ? `${role.color}33` : "transparent"}`,
            borderRadius: 10, padding: "7px 14px",
            color: activeSection === s.id ? role.color : T.textMut,
            fontSize: 12, fontWeight: activeSection === s.id ? 700 : 500,
            cursor: "pointer", whiteSpace: "nowrap", position: "relative",
            fontFamily: "'Outfit', sans-serif", transition: "all 0.2s",
          }}>
            <span style={{ marginRight: 5 }}>{s.icon}</span>{s.label}
            {s.badge && (
              <span style={{
                position: "absolute", top: 1, right: 1,
                background: T.red, color: T.white,
                fontSize: 8, fontWeight: 800,
                width: 15, height: 15, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{s.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {/* ─── SIDEBAR OVERLAY ─── */}
      {sidebarOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}>
          <div onClick={() => setSidebarOpen(false)} style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
          }} />
          <div style={{
            position: "relative", width: 280, background: T.bgCard,
            borderRight: `1px solid ${T.border}`, padding: 20,
            display: "flex", flexDirection: "column", height: "100%",
            overflowY: "auto",
          }}>
            <div style={{
              background: `${role.color}0D`, border: `1px solid ${role.color}22`,
              borderRadius: 14, padding: 16, marginBottom: 20,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `linear-gradient(135deg, ${role.color}44, ${role.color}11)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, marginBottom: 10,
              }}>{role.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{user.nombre}</div>
              <div style={{ fontSize: 12, color: role.color, fontWeight: 600, marginTop: 2 }}>{role.label}</div>
              <div style={{ fontSize: 10, color: T.textMut, marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                ID: {user.id} · RUT: •••••{user.id.slice(-2)}
              </div>
            </div>

            <div style={{ fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, fontWeight: 700 }}>
              Navegación
            </div>
            {role.sections.map(s => (
              <button key={s.id} onClick={() => { setActiveSection(s.id); setSidebarOpen(false); }} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10, border: "none",
                background: activeSection === s.id ? `${role.color}15` : "transparent",
                color: activeSection === s.id ? role.color : T.textSec,
                fontSize: 13, fontWeight: activeSection === s.id ? 700 : 500,
                cursor: "pointer", width: "100%", textAlign: "left",
                fontFamily: "'Outfit', sans-serif", marginBottom: 2,
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                {s.label}
                {s.badge && <span style={{
                  marginLeft: "auto", background: T.red, color: T.white,
                  fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 10,
                }}>{s.badge}</span>}
              </button>
            ))}

            <div style={{ marginTop: "auto", paddingTop: 20 }}>
              <div style={{
                background: T.bg, borderRadius: 12, padding: 14,
                border: `1px solid ${T.border}`, marginBottom: 12,
              }}>
                <div style={{ fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, fontWeight: 700 }}>
                  Sesión Activa
                </div>
                <div style={{ fontSize: 11, color: T.textSec, marginBottom: 4 }}>
                  🔒 Token JWT · {user.rol === "pauta" || user.rol === "libre" ? "30 min" : user.rol === "supervisor" ? "2 hrs" : "4 hrs"}
                </div>
                <div style={{ fontSize: 11, color: T.textSec, marginBottom: 4 }}>
                  {(user.rol === "supervisor" || user.rol === "admin") ? "✅ 2FA verificado" : "🔑 Auth estándar"}
                </div>
                <div style={{ fontSize: 10, color: T.textMut, fontFamily: "'JetBrains Mono', monospace" }}>
                  {new Date().toLocaleTimeString("es-CL")}
                </div>
              </div>
              <button onClick={onLogout} style={{
                width: "100%", padding: "10px 16px",
                background: T.redGhost, border: `1px solid ${T.red}33`,
                borderRadius: 10, color: T.red, fontSize: 13,
                fontWeight: 600, cursor: "pointer",
                fontFamily: "'Outfit', sans-serif",
              }}>
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <main style={{ flex: 1, padding: 16, maxWidth: 540, margin: "0 auto", width: "100%" }}>
        <RoleContent user={user} rol={user.rol} section={activeSection} />
      </main>
    </div>
  );
}
