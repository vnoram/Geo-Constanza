import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { T, FONT, ROLES, SECCIONES_GGSS_PERSONAL } from "../../theme/theme";
import { Icon } from "../ui/Icon";
import { TarjetaUsuario } from "./TarjetaUsuario";
import { PerfilDialogo } from "./PerfilDialogo";
import { Wordmark } from "../ui/Wordmark";
import { ROLES as ROL } from "../../constants/roles";
import { Placeholder } from "../ui/Placeholder";
import { CambiarPasswordModal } from "./CambiarPasswordModal";

// ─── GGSS en pauta ───
import { PautaTurno } from "../../screens/ggss-en-pauta/PautaTurno";
import { PautaNovedades } from "../../screens/ggss-en-pauta/PautaNovedades";
import { PautaHistorial } from "../../screens/ggss-en-pauta/PautaHistorial";
import { PautaAlertas } from "../../screens/ggss-en-pauta/PautaAlertas";

// ─── GGSS libre ───
import { LibreTurnos } from "../../screens/ggss-libre/LibreTurnos";
import { LibreDocs } from "../../screens/ggss-libre/LibreDocs";

// ─── Supervisor ───
import { SupDashboard } from "../../screens/supervisor/SupDashboard";
import { SupNovedades } from "../../screens/supervisor/SupNovedades";
import { SupSolicitudes } from "../../screens/supervisor/SupSolicitudes";
import { SupGuardias } from "../../screens/supervisor/SupGuardias";
import { SupReportes } from "../../screens/supervisor/SupReportes";

// ─── Operador central ───
import { CentralPanel } from "../../screens/operador-central/CentralPanel";

// ─── Plataforma (super admin) ───
import { EmpresasPanel } from "../../screens/plataforma/EmpresasPanel";
import { PlataformaDispositivos } from "../../screens/plataforma/PlataformaDispositivos";

// ─── Administrador ───
import { AdminPanel } from "../../screens/administrador/AdminPanel";
import { AdminDispositivos } from "../../screens/administrador/AdminDispositivos";
import { SolicitudesPersonales } from "../../screens/ggss-libre/SolicitudesPersonales";
import { AdminUsuarios } from "../../screens/administrador/AdminUsuarios";
import { AdminInstalaciones } from "../../screens/administrador/AdminInstalaciones";
import { AdminTurnos } from "../../screens/administrador/AdminTurnos";
import { AdminAuditoria } from "../../screens/administrador/AdminAuditoria";
import { AdminBI } from "../../screens/administrador/AdminBI";
import { MisDispositivos } from "../../screens/MisDispositivos";
import { AdminDocumentos } from "../../screens/administrador/AdminDocumentos";

function seccionesPara(user) {
  if (user.dispositivo === "personal" && [ROL.GGSS].includes(user.rol)) {
    return SECCIONES_GGSS_PERSONAL.map(s => s.id === "turnos" ? { ...s, label: "Mi pauta" } : s);
  }
  const secciones = ROLES[user.rol].sections;
  const extra = [];
  if (user.rol === ROL.ADMINISTRADOR) extra.push({ id: "documentos", icon: "folder", label: "Documentos" });
  if ([ROL.ADMINISTRADOR, ROL.SUPERVISOR, ROL.OPERADOR_CENTRAL].includes(user.rol)) extra.push({ id: "dispositivos", icon: "key-round", label: "Dispositivos" });
  return [...secciones, ...extra];
}

function RoleContent({ user, rol, section, enfoqueNovedad, onAbrirNovedad, onNovedadAbierta }) {
  const allowed = seccionesPara(user).map(s => s.id);
  if (!allowed.includes(section)) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}><Icon name="ban" size={48} /></div>
        <div style={{ color: T.red, fontWeight: 700, fontSize: 16 }}>Acceso Denegado</div>
        <div style={{ color: T.textMut, fontSize: 13, marginTop: 6 }}>
          Tu rol ({ROLES[rol]?.label}) no tiene permisos para esta sección.
        </div>
      </div>
    );
  }

  if (user.dispositivo === "personal" && [ROL.GGSS].includes(rol)) {
    if (section === "turnos") return <LibreTurnos />;
    if (section === "solicitudes") return <SolicitudesPersonales />;
    if (section === "docs") return <LibreDocs />;
  }

  if (rol === ROL.GGSS) {
    if (section === "turno") return <PautaTurno user={user} />;
    if (section === "novedades") return <PautaNovedades user={user} />;
    if (section === "historial") return <PautaHistorial user={user} />;
    if (section === "alertas") return <PautaAlertas />;
  }
  if (section === "dispositivos" && [ROL.SUPERVISOR, ROL.OPERADOR_CENTRAL].includes(rol)) return <MisDispositivos user={user} />;
  if (rol === ROL.SUPERVISOR) {
    if (section === "dashboard") return <SupDashboard />;
    if (section === "novedades") return <SupNovedades />;
    if (section === "solicitudes") return <SupSolicitudes />;
    if (section === "guardias") return <SupGuardias />;
    if (section === "reportes") return <SupReportes />;
  }
  if (rol === ROL.OPERADOR_CENTRAL) {
    // "panel" reutiliza el dashboard completo con mapa + KPIs de AdminPanel
    if (section === "panel")      return <AdminPanel onAbrirNovedad={onAbrirNovedad} />;
    if (section === "incidentes") return <CentralPanel section="incidentes" novedadId={enfoqueNovedad} onNovedadAbierta={onNovedadAbierta} />;
  }
  if (rol === ROL.SUPER_ADMIN) {
    if (section === "empresas") return <EmpresasPanel />;
    if (section === "dispositivos") return <PlataformaDispositivos />;
  }
  if (rol === ROL.ADMINISTRADOR) {
    // Admin ya no tiene el panel de monitoreo — solo gestión RRHH/config
    if (section === "dispositivos") return <AdminDispositivos />;
    if (section === "indicadores")   return <AdminBI />;
    if (section === "documentos")    return <AdminDocumentos />;
    if (section === "usuarios")      return <AdminUsuarios />;
    if (section === "instalaciones") return <AdminInstalaciones />;
    if (section === "turnos")        return <AdminTurnos />;
    if (section === "auditoria")     return <AdminAuditoria />;
  }
  return <Placeholder section={section} />;
}

export function AppShell({ user, onLogout }) {
  const role = ROLES[user.rol];
  const [pendientes, setPendientes] = useState(0);
  const [novedadesPend, setNovedadesPend] = useState(0);
  const [porReasignar, setPorReasignar] = useState(0);
  // Insignia real de solicitudes pendientes para el supervisor (se refresca cada minuto y al resolver una)
  useEffect(() => {
    if (user.rol !== ROL.SUPERVISOR) return undefined;
    let vigente = true;
    const cargar = () => api.get("/solicitudes?estado=pendiente&limit=1")
      .then((res) => { if (vigente) setPendientes(Number(res?.total) || 0); })
      .catch(() => {});
    // Novedades sin resolver (abiertas, en atención o escaladas): mismo criterio que la pestaña «Pendientes».
    const cargarNovedades = () => Promise.all(["abierta", "en_atencion", "escalada"].map((e) => api.get(`/novedades?estado=${e}&limit=1`)))
      .then((r) => { if (vigente) setNovedadesPend(r.reduce((n, x) => n + (Number(x?.total) || 0), 0)); })
      .catch(() => {});
    const cargarReasignar = () => api.get("/turnos/por-reasignar")
      .then((r) => { if (vigente) setPorReasignar(Array.isArray(r) ? r.length : 0); })
      .catch(() => {});
    const todo = () => { cargar(); cargarNovedades(); cargarReasignar(); };
    todo();
    const timer = setInterval(todo, 60000);
    window.addEventListener("gc:solicitudes-cambio", cargar);
    window.addEventListener("gc:novedades-cambio", cargarNovedades);
    window.addEventListener("gc:reasignar-cambio", cargarReasignar);
    return () => {
      vigente = false; clearInterval(timer);
      window.removeEventListener("gc:solicitudes-cambio", cargar);
      window.removeEventListener("gc:novedades-cambio", cargarNovedades);
      window.removeEventListener("gc:reasignar-cambio", cargarReasignar);
    };
  }, [user.rol]);
  const sections = seccionesPara(user).map((s) => {
    if (user.rol !== ROL.SUPERVISOR) return s;
    if (s.id === "solicitudes") return { ...s, badge: pendientes > 0 ? String(pendientes) : null };
    if (s.id === "dashboard") return { ...s, badge: porReasignar > 0 ? String(porReasignar) : null };
    if (s.id === "novedades") return { ...s, badge: novedadesPend > 0 ? String(novedadesPend) : null };
    return s;
  });
  // Todo guardia (en pauta o libre, en cualquier equipo) se muestra solo como «GGSS».
  const etiquetaRol = [ROL.GGSS].includes(user.rol) ? "GGSS" : role.label;
  const [seleccion, setActiveSection] = useState(sections[0].id);
  // Acceso directo desde el mapa a una novedad (Central): se abre su detalle en la pantalla de novedades
  const [enfoqueNovedad, setEnfoqueNovedad] = useState(null);
  const abrirNovedad = (id) => { setEnfoqueNovedad(id); setActiveSection("incidentes"); };
  const activeSection = sections.some(s => s.id === seleccion) ? seleccion : sections[0].id;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const puedeCambiarPassword = user.dispositivo !== "personal" || user.rol === ROL.SUPER_ADMIN;

  const duracionToken = user.rol === ROL.GGSS ? "30 min" : user.rol === ROL.SUPERVISOR ? "2 h" : user.rol === ROL.SUPER_ADMIN ? "1 h" : "4 h";
  const conSegundoFactor = user.segundoFactor === true;

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
          <Wordmark conLogo />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <span className="app-shell__role" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: T.textSec, whiteSpace: "nowrap", minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: T.focus, flex: "none" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{etiquetaRol}</span>
          </span>
          {user.dispositivo && <span style={{ color: T.textSec, fontSize: 11 }}>Dispositivo {user.dispositivo}</span>}
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
        {sections.map(s => {
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
          <aside className="app-shell__sidebar">
            <TarjetaUsuario user={user} etiquetaRol={etiquetaRol} iconoRol={role.icon} onAbrirPerfil={() => setPerfilAbierto(true)} />

            <div className="app-shell__sidebar-label">
              Navegación
            </div>
            {sections.map((s, indice) => {
              const activa = activeSection === s.id;
              return (
                <button className="touch-target gc-nav-btn" key={s.id}
                  onClick={() => { setActiveSection(s.id); setSidebarOpen(false); }}
                  aria-current={activa ? "page" : undefined}
                  style={{ "--gc-nav-delay": `${indice * 30}ms` }}>
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

            <div className="app-shell__sidebar-footer">
              <button className="touch-target app-shell__logout" onClick={onLogout}>
                <Icon name="log-out" size={16} /> Cerrar sesión
              </button>
            </div>
          </aside>
        </div>

        {/* ─── CONTENIDO ─── */}
        <main className={`app-shell__main ${
          user.rol === ROL.GGSS
            ? "app-shell__main--guardia"
            : "app-shell__main--operativo"
        }`}>
          <RoleContent user={user} rol={user.rol} section={activeSection} enfoqueNovedad={enfoqueNovedad} onAbrirNovedad={abrirNovedad} onNovedadAbierta={() => setEnfoqueNovedad(null)} />
        </main>
      </div>
      {perfilAbierto && (
        <PerfilDialogo user={user} etiquetaRol={etiquetaRol} iconoRol={role.icon} duracionToken={duracionToken} conSegundoFactor={conSegundoFactor}
          puedeCambiarPassword={puedeCambiarPassword} onCerrar={() => setPerfilAbierto(false)}
          onCambiarPassword={() => { setPerfilAbierto(false); setCambiandoPassword(true); }} />
      )}
      {cambiandoPassword && puedeCambiarPassword && (
        <CambiarPasswordModal onClose={() => setCambiandoPassword(false)} onDone={onLogout} />
      )}
    </div>
  );
}
