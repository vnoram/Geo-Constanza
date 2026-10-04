import { useState } from "react";
import { T, FONT, ROLES } from "../../theme/theme";
import { Icon } from "../ui/Icon";
import { Wordmark } from "../ui/Wordmark";
import { ROLES as ROL } from "../../constants/roles";
import { Placeholder } from "../ui/Placeholder";

// ─── GGSS en pauta ───
import { PautaTurno } from "../../screens/ggss-en-pauta/PautaTurno";
import { PautaNovedades } from "../../screens/ggss-en-pauta/PautaNovedades";
import { PautaHistorial } from "../../screens/ggss-en-pauta/PautaHistorial";
import { PautaAlertas } from "../../screens/ggss-en-pauta/PautaAlertas";

// ─── GGSS libre ───
import { LibreTurnos } from "../../screens/ggss-libre/LibreTurnos";
import { LibreSolicitudes } from "../../screens/ggss-libre/LibreSolicitudes";
import { LibreDocs } from "../../screens/ggss-libre/LibreDocs";

// ─── Supervisor ───
import { SupDashboard } from "../../screens/supervisor/SupDashboard";
import { SupNovedades } from "../../screens/supervisor/SupNovedades";
import { SupSolicitudes } from "../../screens/supervisor/SupSolicitudes";
import { SupGuardias } from "../../screens/supervisor/SupGuardias";
import { SupReportes } from "../../screens/supervisor/SupReportes";

// ─── Operador central ───
import { CentralPanel } from "../../screens/operador-central/CentralPanel";

// ─── Administrador ───
import { AdminPanel } from "../../screens/administrador/AdminPanel";
import { AdminUsuarios } from "../../screens/administrador/AdminUsuarios";
import { AdminInstalaciones } from "../../screens/administrador/AdminInstalaciones";
import { AdminTurnos } from "../../screens/administrador/AdminTurnos";
import { AdminAuditoria } from "../../screens/administrador/AdminAuditoria";

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

  if (rol === ROL.GGSS_EN_PAUTA) {
    if (section === "turno") return <PautaTurno user={user} />;
    if (section === "novedades") return <PautaNovedades user={user} />;
    if (section === "historial") return <PautaHistorial />;
    if (section === "alertas") return <PautaAlertas />;
  }
  if (rol === ROL.GGSS_LIBRE) {
    if (section === "turnos") return <LibreTurnos />;
    if (section === "solicitudes") return <LibreSolicitudes />;
    if (section === "docs") return <LibreDocs />;
  }
  if (rol === ROL.SUPERVISOR) {
    if (section === "dashboard") return <SupDashboard />;
    if (section === "novedades") return <SupNovedades />;
    if (section === "solicitudes") return <SupSolicitudes />;
    if (section === "guardias") return <SupGuardias />;
    if (section === "reportes") return <SupReportes />;
  }
  if (rol === ROL.OPERADOR_CENTRAL) {
    // "panel" reutiliza el dashboard completo con mapa + KPIs de AdminPanel
    if (section === "panel")      return <AdminPanel />;
    if (section === "incidentes") return <CentralPanel section="incidentes" />;
  }
  if (rol === ROL.ADMINISTRADOR) {
    // Admin ya no tiene el panel de monitoreo — solo gestión RRHH/config
    if (section === "usuarios")      return <AdminUsuarios />;
    if (section === "instalaciones") return <AdminInstalaciones />;
    if (section === "turnos")        return <AdminTurnos />;
    if (section === "auditoria")     return <AdminAuditoria />;
  }
  return <Placeholder section={section} />;
}

export function AppShell({ user, onLogout }) {
  const role = ROLES[user.rol];
  const [activeSection, setActiveSection] = useState(role.sections[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const duracionToken = user.rol === ROL.GGSS_EN_PAUTA || user.rol === ROL.GGSS_LIBRE ? "30 min" : user.rol === ROL.SUPERVISOR ? "2 h" : "4 h";
  const conSegundoFactor = user.rol === ROL.SUPERVISOR || user.rol === ROL.ADMINISTRADOR;

  return (
    <div className="app-shell" style={{
      minHeight: "100vh", background: T.bg,
      fontFamily: FONT.ui, color: T.text,
      display: "flex", flexDirection: "column",
    }}>
      {/* ─── BARRA SUPERIOR ─── */}
      <header className="app-shell__header" style={{
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        padding: "0 16px", height: "var(--topbar-h)", display: "flex",
        alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button className="app-shell__menu-button touch-target" onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Abrir menú" style={{
            background: "none", border: "none", color: T.textSec, cursor: "pointer",
            padding: 4, display: "inline-flex", alignItems: "center",
          }}><Icon name="menu" size={20} /></button>
          <Wordmark />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <span className="app-shell__role" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: T.textSec, whiteSpace: "nowrap", minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: T.focus, flex: "none" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{role.label}</span>
          </span>
          <span className="app-shell__user" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: T.textMut, whiteSpace: "nowrap" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, flex: "none" }} />
            {user.nombre.split(" ")[0]}
          </span>
        </div>
      </header>

      {/* ─── PESTAÑAS (celular y tablet) ─── */}
      <nav className="app-shell__tabs" style={{
        display: "flex", gap: 0, padding: "0 10px",
        overflowX: "auto", background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        WebkitOverflowScrolling: "touch",
      }}>
        {role.sections.map(s => {
          const activa = activeSection === s.id;
          return (
            <button className="touch-target" key={s.id} onClick={() => setActiveSection(s.id)}
              aria-current={activa ? "page" : undefined} style={{
              background: "transparent", border: "none",
              borderBottom: `2px solid ${activa ? T.focus : "transparent"}`,
              padding: "0 14px", minHeight: 44,
              color: activa ? T.text : T.textSec,
              fontSize: 13, fontWeight: activa ? 600 : 500,
              cursor: "pointer", whiteSpace: "nowrap", position: "relative",
              fontFamily: FONT.ui, display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              <Icon name={s.icon} size={17} color={activa ? T.focusText : T.textMut} />
              {s.label}
              {s.badge && (
                <span style={{
                  background: T.alertGhost, color: T.alert, border: `1px solid ${T.alert}`,
                  fontSize: 11, fontWeight: 500, fontFamily: FONT.mono, lineHeight: "16px",
                  minWidth: 18, padding: "0 5px", borderRadius: 8, textAlign: "center",
                }}>{s.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="app-shell__body">
        {/* ─── MENÚ LATERAL: cajón en celular, fijo en escritorio ─── */}
        <div className={`app-shell__sidebar-layer${sidebarOpen ? " is-open" : ""}`}>
          <div className="app-shell__sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
          <aside className="app-shell__sidebar" style={{
            background: T.surface, borderRight: `1px solid ${T.border}`,
          }}>
            <div style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: T.text }}>{user.nombre}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.textSec, marginTop: 4 }}>
                <Icon name={role.icon} size={15} color={T.focusText} />
                {role.label}
              </div>
              <div style={{ fontSize: 11, color: T.textMut, marginTop: 8, fontFamily: FONT.mono }}>
                ID {user.id} · RUT •••••{user.id.slice(-2)}
              </div>
            </div>

            <div style={{ fontSize: 11, color: T.textMut, marginBottom: 6, fontWeight: 500 }}>
              Navegación
            </div>
            {role.sections.map(s => {
              const activa = activeSection === s.id;
              return (
                <button className="touch-target" key={s.id}
                  onClick={() => { setActiveSection(s.id); setSidebarOpen(false); }}
                  aria-current={activa ? "page" : undefined} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "0 12px", minHeight: 40, borderRadius: T.radius,
                  border: "none", borderLeft: `2px solid ${activa ? T.focus : "transparent"}`,
                  background: activa ? T.focusGhost : "transparent",
                  color: activa ? T.text : T.textSec,
                  fontSize: 14, fontWeight: activa ? 600 : 500,
                  cursor: "pointer", width: "100%", textAlign: "left",
                  fontFamily: FONT.ui, marginBottom: 2,
                }}>
                  <Icon name={s.icon} size={18} color={activa ? T.focusText : T.textMut} />
                  {s.label}
                  {s.badge && <span style={{
                    marginLeft: "auto", background: T.alertGhost, color: T.alert,
                    border: `1px solid ${T.alert}`, fontSize: 11, fontFamily: FONT.mono,
                    lineHeight: "16px", minWidth: 18, padding: "0 5px", borderRadius: 8, textAlign: "center",
                  }}>{s.badge}</span>}
                </button>
              );
            })}

            <div style={{ marginTop: "auto", paddingTop: 20 }}>
              <div style={{
                border: `1px solid ${T.border}`, borderRadius: T.radius,
                padding: 12, marginBottom: 10, fontSize: 12, color: T.textSec,
              }}>
                <div style={{ fontSize: 11, color: T.textMut, marginBottom: 8, fontWeight: 500 }}>Sesión</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Icon name="clock" size={14} /> Token JWT · <span style={{ fontFamily: FONT.mono }}>{duracionToken}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Icon name={conSegundoFactor ? "check" : "key-round"} size={14} color={conSegundoFactor ? T.accent : "currentColor"} />
                  {conSegundoFactor ? "2FA verificado" : "Autenticación estándar"}
                </div>
                <div style={{ fontSize: 11, color: T.textMut, fontFamily: FONT.mono }}>
                  {new Date().toLocaleTimeString("es-CL", { timeZone: "America/Santiago" })}
                </div>
              </div>
              <button className="touch-target" onClick={onLogout} style={{
                width: "100%", minHeight: 40, padding: "0 14px",
                background: "transparent", border: `1px solid ${T.border}`,
                borderRadius: T.radius, color: T.text, fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: FONT.ui,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <Icon name="log-out" size={16} /> Cerrar sesión
              </button>
            </div>
          </aside>
        </div>

        {/* ─── CONTENIDO ─── */}
        <main className={`app-shell__main ${
          user.rol === ROL.GGSS_EN_PAUTA || user.rol === ROL.GGSS_LIBRE
            ? "app-shell__main--guardia"
            : "app-shell__main--operativo"
        }`}>
          <RoleContent user={user} rol={user.rol} section={activeSection} />
        </main>
      </div>
    </div>
  );
}
