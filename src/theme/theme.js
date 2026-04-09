// ─── THEME TOKENS ───
export const T = {
  bg: "#060D18",
  bgCard: "#0D1A2D",
  bgCardHover: "#122240",
  bgInput: "#0A1628",
  border: "#1A2D4A",
  borderFocus: "#00E5B0",
  accent: "#00E5B0",
  accentDim: "#00B88D",
  accentGhost: "rgba(0,229,176,0.08)",
  accentGlow: "rgba(0,229,176,0.20)",
  red: "#FF5270",
  redGhost: "rgba(255,82,112,0.10)",
  yellow: "#FFBE2E",
  yellowGhost: "rgba(255,190,46,0.10)",
  text: "#E4EAF2",
  textSec: "#7B8FA8",
  textMut: "#4A5E78",
  white: "#FFFFFF",
};

// ─── ROLE METADATA ───
export const ROLES = {
  pauta: {
    label: "GGSS en Pauta",
    icon: "🛡️",
    color: T.accent,
    desc: "Guardia en turno activo",
    sections: [
      { id: "turno", icon: "📍", label: "Mi Turno", badge: null },
      { id: "novedades", icon: "🚨", label: "Novedades", badge: null },
      { id: "historial", icon: "📋", label: "Historial", badge: null },
      { id: "alertas", icon: "🔔", label: "Alertas", badge: "1" },
    ],
  },
  libre: {
    label: "GGSS Libre",
    icon: "📅",
    color: "#6C9BFF",
    desc: "Guardia sin turno activo",
    sections: [
      { id: "turnos", icon: "📅", label: "Mis Turnos", badge: null },
      { id: "solicitudes", icon: "📝", label: "Solicitudes", badge: null },
      { id: "docs", icon: "📁", label: "Documentos", badge: null },
    ],
  },
  supervisor: {
    label: "Supervisor",
    icon: "📊",
    color: T.yellow,
    desc: "Panel de supervisión",
    sections: [
      { id: "dashboard", icon: "📊", label: "Dashboard", badge: "3" },
      { id: "novedades", icon: "🚨", label: "Novedades", badge: "2" },
      { id: "solicitudes", icon: "📝", label: "Solicitudes", badge: "1" },
      { id: "guardias", icon: "👥", label: "Guardias", badge: null },
      { id: "reportes", icon: "📑", label: "Reportes", badge: null },
    ],
  },
  admin: {
    label: "Central / Admin",
    icon: "⚙️",
    color: "#B98CFF",
    desc: "Gestión completa del sistema",
    sections: [
      { id: "panel", icon: "📊", label: "Panel", badge: null },
      { id: "usuarios", icon: "👥", label: "Usuarios", badge: null },
      { id: "instalaciones", icon: "🏢", label: "Instalaciones", badge: null },
      { id: "turnos", icon: "📅", label: "Turnos", badge: null },
      { id: "auditoria", icon: "🔍", label: "Auditoría", badge: null },
    ],
  },
};
