import { ROLES as ROL } from "../constants/roles";

// ─── THEME TOKENS ───
// Paleta fija. Verde = sistema en calma / en geocerca. Naranja = alerta y acción
// principal. Morado = foco, selección y rol activo. El resto es neutro.
// Los nombres se conservan para que las pantallas existentes hereden el rediseño.
export const T = {
  bg: "#0E1714",          // fondo de la app
  surface: "#162420",     // topbar, sidebar, paneles
  bgCard: "#1C2E28",      // card
  bgCardHover: "#22372F", // derivado: hover de card
  bgInput: "#0E1714",
  border: "#2C4038",      // línea de 1px
  borderFocus: "#7A4EBF", // foco
  accent: "#3E9A72",      // verde operativo
  accentDim: "#2F7757",   // derivado: verde pulsado
  accentGhost: "rgba(62,154,114,0.12)",
  accentGlow: "transparent", // sin resplandores
  focus: "#7A4EBF",       // morado: selección / foco / rol activo
  focusText: "#B39BE0",   // derivado: tinte claro del morado para texto
  focusGhost: "rgba(122,78,191,0.16)",
  alert: "#E86A2A",       // naranja: alerta y acción principal
  alertGhost: "rgba(232,106,42,0.12)",
  red: "#E86A2A",         // errores y destructivo usan el mismo naranja
  redGhost: "rgba(232,106,42,0.12)",
  yellow: "#F0A35E",      // derivado: naranja claro (nivel medio de urgencia)
  yellowGhost: "rgba(240,163,94,0.12)",
  text: "#F3EFE6",
  textSec: "#A8B7AE",
  textMut: "#7C8F85",     // derivado: texto atenuado
  white: "#F3EFE6",
  ink: "#0E1714",         // texto sobre naranja / verde
  radius: 8,
};

// Tipografía: IBM Plex Sans para la interfaz; IBM Plex Mono solo para RUT,
// horas, IDs y coordenadas.
export const FONT = {
  ui: "var(--font-ui)",
  mono: "var(--font-mono)",
};

// ─── ROLE METADATA ───
// `icon` es el nombre de un ícono Lucide (ver components/ui/Icon.jsx).
// Todos los roles comparten el morado: indica el rol activo, no una marca por rol.
export const ROLES = {
  [ROL.GGSS_EN_PAUTA]: {
    label: "GGSS en Pauta",
    icon: "user-round-check",
    color: T.focusText,
    desc: "Guardia en turno activo",
    sections: [
      { id: "turno", icon: "map-pin", label: "Mi Turno", badge: null },
      { id: "novedades", icon: "triangle-alert", label: "Novedades", badge: null },
      { id: "historial", icon: "clipboard-list", label: "Historial", badge: null },
      { id: "alertas", icon: "bell", label: "Alertas", badge: "1" },
    ],
  },
  [ROL.GGSS_LIBRE]: {
    label: "GGSS Libre",
    icon: "user-round",
    color: T.focusText,
    desc: "Guardia sin turno activo",
    sections: [
      { id: "turnos", icon: "calendar-days", label: "Mis Turnos", badge: null },
      { id: "solicitudes", icon: "file-text", label: "Solicitudes", badge: null },
      { id: "docs", icon: "folder", label: "Documentos", badge: null },
    ],
  },
  [ROL.SUPERVISOR]: {
    label: "Supervisor",
    icon: "clipboard-check",
    color: T.focusText,
    desc: "Panel de supervisión",
    sections: [
      { id: "dashboard", icon: "layout-dashboard", label: "Dashboard", badge: "3" },
      { id: "novedades", icon: "triangle-alert", label: "Novedades", badge: "2" },
      { id: "solicitudes", icon: "file-text", label: "Solicitudes", badge: "1" },
      { id: "guardias", icon: "users", label: "Guardias", badge: null },
      { id: "reportes", icon: "chart-column", label: "Reportes", badge: null },
    ],
  },
  [ROL.OPERADOR_CENTRAL]: {
    label: "Central de Monitoreo",
    icon: "radio-tower",
    color: T.focusText,
    desc: "Monitoreo global de operaciones",
    sections: [
      { id: "panel",      icon: "map", label: "Mapa en Vivo", badge: null },
      { id: "incidentes", icon: "triangle-alert", label: "Novedades", badge: null },
    ],
  },
  [ROL.ADMINISTRADOR]: {
    label: "Administración / RRHH",
    icon: "settings",
    color: T.focusText,
    desc: "Gestión de usuarios, instalaciones y turnos",
    sections: [
      { id: "usuarios",      icon: "users", label: "Usuarios", badge: null },
      { id: "instalaciones", icon: "building-2", label: "Instalaciones", badge: null },
      { id: "turnos",        icon: "calendar-days", label: "Turnos", badge: null },
      { id: "auditoria",     icon: "scroll-text", label: "Auditoría", badge: null },
    ],
  },
};
