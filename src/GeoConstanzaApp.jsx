import { useState, useEffect, createContext, useContext, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// GEO CONSTANZA — FASE 1: AUTENTICACIÓN + PANTALLAS BASE
// Repo: github.com/geoconstanza
// Stack: React (frontend) ↔ Express API (backend)
// ═══════════════════════════════════════════════════════════════

// ─── API CONFIG ───
const API_BASE = "https://api.geoconstanza.cl/api/v1"; // Cambiar a tu URL

// ─── THEME TOKENS ───
const T = {
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

// ─── AUTH CONTEXT ───
const AuthCtx = createContext(null);

function useAuth() {
  return useContext(AuthCtx);
}

// ─── SIMULATED API SERVICE ───
// En producción, estas funciones hacen fetch real al backend Express
const api = {
  login: async (rut, password) => {
    // SIMULACIÓN — reemplazar con fetch real:
    // const res = await fetch(`${API_BASE}/auth/login`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ rut, password }),
    // });
    // return res.json();
    
    await new Promise(r => setTimeout(r, 1200));
    const users = {
      "20570418-3": { id: "u1", nombre: "Víctor Norambuena", rol: "pauta", token: "jwt_pauta_mock" },
      "19234567-8": { id: "u2", nombre: "María López", rol: "libre", token: "jwt_libre_mock" },
      "15678901-2": { id: "u3", nombre: "Andrés Martínez", rol: "supervisor", token: "jwt_sup_mock" },
      "12812223-0": { id: "u4", nombre: "Christian González", rol: "admin", token: "jwt_admin_mock" },
    };
    const u = users[rut];
    if (!u || password !== "geo2026") throw new Error("Credenciales inválidas");
    return { user: u, token: u.token, refreshToken: "refresh_" + u.token };
  },

  verify2FA: async (code) => {
    await new Promise(r => setTimeout(r, 800));
    if (code === "123456") return { verified: true };
    throw new Error("Código 2FA inválido");
  },

  getProfile: async (token) => {
    await new Promise(r => setTimeout(r, 400));
    return { lastLogin: "2026-04-09T06:00:00Z", sessionsActive: 1 };
  },
};

// ─── ROLE METADATA ───
const ROLES = {
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

// ═══════════════════ COMPONENTS ═══════════════════

function GlowOrb({ x, y, color, size }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: size, height: size,
      borderRadius: "50%", background: color, filter: "blur(80px)",
      opacity: 0.4, pointerEvents: "none",
    }} />
  );
}

function Input({ label, type = "text", value, onChange, icon, error, placeholder, maxLength }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      {label && <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.textSec, marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</label>}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: T.bgInput, border: `1.5px solid ${error ? T.red : focused ? T.borderFocus : T.border}`,
        borderRadius: 12, padding: "12px 14px", transition: "all 0.25s",
        boxShadow: focused ? `0 0 0 3px ${T.accentGhost}` : "none",
      }}>
        {icon && <span style={{ fontSize: 18, opacity: 0.5 }}>{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          maxLength={maxLength}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: T.text, fontSize: 15, fontFamily: "'Outfit', sans-serif",
            letterSpacing: type === "password" ? 4 : 0,
          }}
        />
      </div>
      {error && <div style={{ fontSize: 12, color: T.red, marginTop: 5, fontWeight: 500 }}>{error}</div>}
    </div>
  );
}

function Btn({ children, onClick, loading, variant = "primary", disabled, full }) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        width: full ? "100%" : "auto",
        padding: isPrimary ? "14px 32px" : "10px 20px",
        background: disabled ? T.textMut : isPrimary ? T.accent : "transparent",
        color: isPrimary ? T.bg : T.accent,
        border: isPrimary ? "none" : `1.5px solid ${T.accent}`,
        borderRadius: 12, fontSize: 14, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: 0.5, transition: "all 0.2s",
        opacity: loading ? 0.7 : 1,
        boxShadow: isPrimary && !disabled ? `0 4px 20px ${T.accentGlow}` : "none",
      }}
    >
      {loading ? "⏳ Procesando..." : children}
    </button>
  );
}

function Badge({ color = "accent", children }) {
  const colors = {
    accent: { bg: T.accentGhost, text: T.accent },
    red: { bg: T.redGhost, text: T.red },
    yellow: { bg: T.yellowGhost, text: T.yellow },
  };
  const c = colors[color] || colors.accent;
  return (
    <span style={{
      background: c.bg, color: c.text, padding: "3px 10px",
      borderRadius: 20, fontSize: 10, fontWeight: 800,
      letterSpacing: 0.8, textTransform: "uppercase",
    }}>{children}</span>
  );
}

function KPI({ label, value, sub, accent }) {
  return (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: "16px 14px", flex: 1, minWidth: 100,
    }}>
      <div style={{ fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent || T.accent, lineHeight: 1, fontFamily: "'Outfit', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.textMut, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ═══════════════════ LOGIN SCREEN ═══════════════════

function LoginScreen({ onLogin }) {
  const [rut, setRut] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("login"); // login | 2fa
  const [code2fa, setCode2fa] = useState("");
  const [pendingUser, setPendingUser] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTime, setLockTime] = useState(0);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    if (locked && lockTime > 0) {
      const timer = setInterval(() => setLockTime(t => {
        if (t <= 1) { setLocked(false); setAttempts(0); return 0; }
        return t - 1;
      }), 1000);
      return () => clearInterval(timer);
    }
  }, [locked, lockTime]);

  const formatRut = (val) => {
    const clean = val.replace(/[^0-9kK-]/g, "");
    setRut(clean);
  };

  const handleLogin = async () => {
    if (locked) return;
    setError("");
    if (!rut.trim()) { setError("Ingrese su RUT"); return; }
    if (!pass.trim()) { setError("Ingrese su contraseña"); return; }

    setLoading(true);
    try {
      const result = await api.login(rut.trim(), pass);
      if (result.user.rol === "supervisor" || result.user.rol === "admin") {
        setPendingUser(result);
        setStep("2fa");
      } else {
        onLogin(result.user, result.token);
      }
      setAttempts(0);
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 5) {
        setLocked(true);
        setLockTime(900); // 15 min = 900 seg
        setError("Cuenta bloqueada por 15 minutos (5 intentos fallidos)");
      } else {
        setError(`${err.message}. Intento ${newAttempts}/5`);
      }
    }
    setLoading(false);
  };

  const handle2FA = async () => {
    setError("");
    if (!code2fa.trim() || code2fa.length < 6) { setError("Ingrese el código de 6 dígitos"); return; }
    setLoading(true);
    try {
      await api.verify2FA(code2fa);
      onLogin(pendingUser.user, pendingUser.token);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center",
      justifyContent: "center", padding: 20, fontFamily: "'Outfit', sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      
      <GlowOrb x="-10%" y="10%" color={T.accentGlow} size={400} />
      <GlowOrb x="70%" y="60%" color="rgba(108,155,255,0.1)" size={350} />
      <GlowOrb x="30%" y="80%" color="rgba(185,140,255,0.06)" size={300} />

      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: `radial-gradient(circle at 1px 1px, ${T.border}22 1px, transparent 0)`,
        backgroundSize: "40px 40px", pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 380 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: step === "login" ? 36 : 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${T.accent}, ${T.accentDim})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, boxShadow: `0 8px 32px ${T.accentGlow}`,
          }}>🛡️</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: T.text, letterSpacing: -0.5 }}>
            Geo Constanza
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: T.textMut }}>
            {step === "login" ? "Plataforma de Gestión Operacional" : "Verificación de Seguridad"}
          </p>
        </div>

        {/* Login Form */}
        {step === "login" && (
          <div style={{
            background: `${T.bgCard}CC`, backdropFilter: "blur(20px)",
            border: `1px solid ${T.border}`, borderRadius: 20, padding: 28,
          }}>
            <Input
              label="RUT"
              icon="🪪"
              value={rut}
              onChange={formatRut}
              placeholder="12345678-9"
              maxLength={12}
              error={null}
            />
            <Input
              label="Contraseña"
              type="password"
              icon="🔒"
              value={pass}
              onChange={setPass}
              placeholder="••••••••"
            />

            {error && (
              <div style={{
                background: T.redGhost, border: `1px solid ${T.red}33`,
                borderRadius: 10, padding: "10px 14px", marginBottom: 16,
                fontSize: 12, color: T.red, fontWeight: 500,
              }}>
                ⚠️ {error}
                {locked && <div style={{ marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                  Desbloqueo en: {Math.floor(lockTime / 60)}:{String(lockTime % 60).padStart(2, "0")}
                </div>}
              </div>
            )}

            <Btn onClick={handleLogin} loading={loading} disabled={locked} full>
              {locked ? `Bloqueado (${Math.floor(lockTime / 60)}:${String(lockTime % 60).padStart(2, "0")})` : "Iniciar Sesión"}
            </Btn>

            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                onClick={() => setShowDemo(!showDemo)}
                style={{
                  background: "none", border: "none", color: T.textMut,
                  fontSize: 12, cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                  textDecoration: "underline", textUnderlineOffset: 3,
                }}
              >
                {showDemo ? "Ocultar credenciales demo" : "Ver credenciales demo"}
              </button>
            </div>

            {showDemo && (
              <div style={{
                marginTop: 12, background: T.accentGhost, border: `1px solid ${T.accent}22`,
                borderRadius: 12, padding: 14, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
              }}>
                <div style={{ color: T.textSec, marginBottom: 8, fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5 }}>
                  Contraseña para todos: geo2026
                </div>
                {[
                  { rut: "20570418-3", rol: "GGSS Pauta", name: "V. Norambuena" },
                  { rut: "19234567-8", rol: "GGSS Libre", name: "M. López" },
                  { rut: "15678901-2", rol: "Supervisor", name: "A. Martínez" },
                  { rut: "12812223-0", rol: "Admin", name: "C. González" },
                ].map((d, i) => (
                  <div key={i}
                    onClick={() => { setRut(d.rut); setPass("geo2026"); }}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                      marginBottom: i < 3 ? 4 : 0,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = T.accentGhost}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ color: T.accent }}>{d.rut}</span>
                    <span style={{ color: T.textMut, fontSize: 10 }}>{d.rol}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2FA Step */}
        {step === "2fa" && (
          <div style={{
            background: `${T.bgCard}CC`, backdropFilter: "blur(20px)",
            border: `1px solid ${T.border}`, borderRadius: 20, padding: 28,
          }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
              <div style={{ fontSize: 14, color: T.textSec }}>
                Ingresa el código de tu app authenticator
              </div>
              <div style={{ fontSize: 11, color: T.textMut, marginTop: 4 }}>
                Requerido para <span style={{ color: ROLES[pendingUser?.user?.rol]?.color }}>{ROLES[pendingUser?.user?.rol]?.label}</span>
              </div>
            </div>

            <Input
              label="Código 2FA"
              icon="🔑"
              value={code2fa}
              onChange={v => setCode2fa(v.replace(/\D/g, ""))}
              placeholder="123456"
              maxLength={6}
            />

            {error && (
              <div style={{
                background: T.redGhost, borderRadius: 10, padding: "10px 14px",
                marginBottom: 16, fontSize: 12, color: T.red,
              }}>⚠️ {error}</div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" onClick={() => { setStep("login"); setCode2fa(""); setError(""); setPendingUser(null); }}>
                ← Volver
              </Btn>
              <Btn onClick={handle2FA} loading={loading} full>
                Verificar
              </Btn>
            </div>

            <div style={{
              marginTop: 16, background: T.yellowGhost, borderRadius: 10,
              padding: 12, fontSize: 11, color: T.yellow,
            }}>
              💡 Demo: usa el código <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>123456</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: T.textMut }}>
          Geo Constanza v1.0 · Fase 1 · Abril 2026
        </div>
      </div>
    </div>
  );
}

// ═══════════════════ APP SHELL (POST-LOGIN) ═══════════════════

function AppShell({ user, token, onLogout }) {
  const role = ROLES[user.rol];
  const [activeSection, setActiveSection] = useState(role.sections[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);

  useEffect(() => {
    api.getProfile(token).then(setSessionInfo).catch(() => {});
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
            fontFamily: "'Outfit', sans-serif",
            transition: "all 0.2s",
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
            {/* User Card */}
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

            {/* Nav Items */}
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

            {/* Session Info */}
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
        <RoleContent user={user} rol={user.rol} section={activeSection} roleColor={role.color} />
      </main>
    </div>
  );
}

// ═══════════════════ ROLE CONTENT ROUTER ═══════════════════

function RoleContent({ user, rol, section, roleColor }) {
  // Guard de ruta: solo muestra contenido autorizado para el rol
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

  // ─── GGSS EN PAUTA ───
  if (rol === "pauta") {
    if (section === "turno") return <PautaTurno user={user} />;
    if (section === "novedades") return <PautaNovedades user={user} />;
    if (section === "historial") return <PautaHistorial />;
    if (section === "alertas") return <PautaAlertas />;
  }

  // ─── GGSS LIBRE ───
  if (rol === "libre") {
    if (section === "turnos") return <LibreTurnos />;
    if (section === "solicitudes") return <LibreSolicitudes />;
    if (section === "docs") return <LibreDocs />;
  }

  // ─── SUPERVISOR ───
  if (rol === "supervisor") {
    if (section === "dashboard") return <SupDashboard />;
    if (section === "novedades") return <SupNovedades />;
    if (section === "solicitudes") return <SupSolicitudes />;
    if (section === "guardias") return <SupGuardias />;
    if (section === "reportes") return <SupReportes />;
  }

  // ─── ADMIN ───
  if (rol === "admin") {
    if (section === "panel") return <AdminPanel />;
    if (section === "usuarios") return <AdminUsuarios />;
    if (section === "instalaciones") return <AdminInstalaciones />;
    if (section === "turnos") return <AdminTurnos />;
    if (section === "auditoria") return <AdminAuditoria />;
  }

  return <Placeholder section={section} />;
}

// ═══════════════════ PANTALLAS BASE — GGSS PAUTA ═══════════════════

function PautaTurno({ user }) {
  return (
    <div>
      <SectionHeader title="Mi Turno Actual" sub="Información de tu turno en curso" />
      <div style={{
        background: `linear-gradient(135deg, ${T.accentGhost}, transparent)`,
        border: `1px solid ${T.accent}33`, borderRadius: 16, padding: 20, marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 11, color: T.accentDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2 }}>EN TURNO</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginTop: 4 }}>Centro Comercial Arauco</div>
            <div style={{ fontSize: 13, color: T.textSec, marginTop: 4 }}>06:00 — 14:00 · Turno Diurno</div>
          </div>
          <div style={{
            width: 10, height: 10, borderRadius: "50%", background: T.accent,
            boxShadow: `0 0 12px ${T.accent}`, marginTop: 4,
            animation: "pulse 2s infinite",
          }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Badge>Activo</Badge>
          <Badge color="accent">Tablet OK</Badge>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <KPI label="Entrada" value="06:02" sub="Normal" />
        <KPI label="Horas" value="2h 28m" sub="de 8h programadas" />
      </div>

      {/* Fallback Button */}
      <div style={{
        background: T.bgCard, border: `1px dashed ${T.border}`,
        borderRadius: 14, padding: 16, textAlign: "center",
      }}>
        <div style={{ fontSize: 12, color: T.textMut, marginBottom: 10 }}>
          ⚠️ Solo usar si la tablet no está disponible
        </div>
        <Btn variant="ghost">📍 Marcaje Fallback</Btn>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}

function PautaNovedades({ user }) {
  const [novedades] = useState([
    { id: 1, tipo: "Acceso no autorizado", urgencia: "rojo", hora: "06:23", desc: "Persona intentó ingresar por acceso trasero", estado: "abierta" },
    { id: 2, tipo: "Sin novedad", urgencia: "verde", hora: "08:00", desc: "Ronda completada sin incidentes", estado: "resuelta" },
  ]);

  return (
    <div>
      <SectionHeader title="Novedades" sub="Reporta incidencias durante tu turno" action={{ label: "+ Reportar", onClick: () => {} }} />
      {novedades.map(n => (
        <div key={n.id} style={{
          background: T.bgCard, border: `1px solid ${T.border}`,
          borderLeft: `4px solid ${n.urgencia === "rojo" ? T.red : n.urgencia === "amarillo" ? T.yellow : T.accent}`,
          borderRadius: 12, padding: 14, marginBottom: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{n.tipo}</span>
            <Badge color={n.urgencia === "rojo" ? "red" : n.urgencia === "amarillo" ? "yellow" : "accent"}>{n.urgencia}</Badge>
          </div>
          <div style={{ fontSize: 12, color: T.textMut }}>{n.hora} · {n.desc}</div>
          <div style={{ marginTop: 6 }}><Badge color={n.estado === "abierta" ? "yellow" : "accent"}>{n.estado}</Badge></div>
        </div>
      ))}
    </div>
  );
}

function PautaHistorial() {
  const data = [
    { fecha: "09 Abr", entrada: "06:02", salida: "—", estado: "En curso", horas: "—" },
    { fecha: "08 Abr", entrada: "06:12", salida: "14:00", estado: "Tardío", horas: "7h 48m" },
    { fecha: "07 Abr", entrada: "06:00", salida: "14:10", estado: "Normal", horas: "8h 10m" },
    { fecha: "06 Abr", entrada: "05:58", salida: "14:05", estado: "Normal", horas: "8h 07m" },
  ];
  return (
    <div>
      <SectionHeader title="Historial" sub="Tu registro de asistencia" />
      {data.map((h, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{h.fecha}</div>
            <div style={{ fontSize: 11, color: T.textMut }}>{h.entrada} → {h.salida}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Badge color={h.estado === "Normal" ? "accent" : h.estado === "En curso" ? "yellow" : "red"}>{h.estado}</Badge>
            <div style={{ fontSize: 10, color: T.textMut, marginTop: 4 }}>{h.horas}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PautaAlertas() {
  return (
    <div>
      <SectionHeader title="Alertas" sub="Notificaciones de tu turno" />
      <div style={{ background: T.yellowGhost, border: `1px solid ${T.yellow}22`, borderRadius: 12, padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: T.yellow, fontWeight: 600 }}>⚠️ Turno mañana: 06:00 — 14:00</div>
        <div style={{ fontSize: 11, color: T.textMut, marginTop: 4 }}>Centro Comercial Arauco · Confirmado</div>
      </div>
      <div style={{ background: T.accentGhost, border: `1px solid ${T.accent}22`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 13, color: T.accent, fontWeight: 600 }}>✅ Tu novedad fue recibida por supervisor</div>
        <div style={{ fontSize: 11, color: T.textMut, marginTop: 4 }}>Hace 15 minutos · A. Martínez</div>
      </div>
    </div>
  );
}

// ═══════════════════ PANTALLAS BASE — GGSS LIBRE ═══════════════════

function LibreTurnos() {
  const turnos = [
    { fecha: "10 Abr", inicio: "14:00", fin: "22:00", inst: "Edificio Corp. Atlas", estado: "Confirmado" },
    { fecha: "12 Abr", inicio: "22:00", fin: "06:00", inst: "Condominio Los Álamos", estado: "Pendiente" },
    { fecha: "15 Abr", inicio: "06:00", fin: "14:00", inst: "Centro Comercial Arauco", estado: "Confirmado" },
    { fecha: "18 Abr", inicio: "14:00", fin: "22:00", inst: "Faena Industrial Norte", estado: "Confirmado" },
  ];
  return (
    <div>
      <SectionHeader title="Mis Turnos" sub="Próximos 60 días" />
      {turnos.map((t, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t.fecha}</div>
            <div style={{ fontSize: 12, color: T.textSec }}>{t.inicio} — {t.fin}</div>
            <div style={{ fontSize: 11, color: T.textMut, marginTop: 2 }}>{t.inst}</div>
          </div>
          <Badge color={t.estado === "Confirmado" ? "accent" : "yellow"}>{t.estado}</Badge>
        </div>
      ))}
    </div>
  );
}

function LibreSolicitudes() {
  return (
    <div>
      <SectionHeader title="Solicitudes" sub="Gestiona tus peticiones" action={{ label: "+ Nueva", onClick: () => {} }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { icon: "🏖️", label: "Vacaciones" },
          { icon: "➕", label: "Turno Extra" },
          { icon: "🚫", label: "Ausencia" },
          { icon: "🔄", label: "Cambio Inst." },
        ].map((t, i) => (
          <button key={i} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
            padding: "14px 10px", color: T.text, fontSize: 12, fontWeight: 600,
            cursor: "pointer", textAlign: "center", fontFamily: "'Outfit', sans-serif",
            transition: "all 0.15s",
          }}>{t.icon} {t.label}</button>
        ))}
      </div>
      <div style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 13 }}>
        📝 No tienes solicitudes activas
      </div>
    </div>
  );
}

function LibreDocs() {
  const docs = ["Contrato Vigente", "Liquidación Marzo 2026", "Certificado OS-10", "Anexo Contrato Ene 2026"];
  return (
    <div>
      <SectionHeader title="Documentos" sub="Tu documentación personal" />
      {docs.map((d, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>{["📄", "💰", "🎓", "📎"][i]}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{d}</span>
          </div>
          <span style={{ color: T.accent, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Descargar →</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════ PANTALLAS BASE — SUPERVISOR ═══════════════════

function SupDashboard() {
  return (
    <div>
      <SectionHeader title="Dashboard en Vivo" sub="Estado operacional en tiempo real" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <KPI label="Activos" value="4" sub="de 5 esperados" accent={T.accent} />
        <KPI label="Ausentes" value="1" sub="C. Muñoz" accent={T.red} />
        <KPI label="Incidentes" value="2" sub="1 crítico" accent={T.yellow} />
        <KPI label="Puntualidad" value="80%" sub="hoy" accent={T.accent} />
      </div>

      <SubHeader title="GGSS en Pauta Ahora" />
      {[
        { n: "V. Norambuena", inst: "CC Arauco", entrada: "06:02", chk: "08:15", st: "activo" },
        { n: "M. López", inst: "CC Arauco", entrada: "06:10", chk: "07:45", st: "alerta" },
        { n: "J. García", inst: "Cond. Los Álamos", entrada: "06:00", chk: "08:20", st: "activo" },
        { n: "R. Soto", inst: "Edif. Atlas", entrada: "06:15", chk: "08:10", st: "activo" },
        { n: "C. Muñoz", inst: "Faena Norte", entrada: "—", chk: "—", st: "ausente" },
      ].map((g, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          borderLeft: `3px solid ${g.st === "activo" ? T.accent : g.st === "alerta" ? T.yellow : T.red}`,
          padding: 12, marginBottom: 5, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{g.n}</div>
            <div style={{ fontSize: 11, color: T.textMut }}>{g.inst}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: T.textMut }}>Entrada: {g.entrada}</div>
            <div style={{ fontSize: 10, color: T.textMut }}>Ult. chk: {g.chk}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SupNovedades() {
  const novedades = [
    { tipo: "Acceso no autorizado", urgencia: "rojo", guardia: "M. López", inst: "CC Arauco", hora: "06:23", desc: "Persona intentó ingresar por acceso trasero" },
    { tipo: "Mantenimiento", urgencia: "amarillo", guardia: "R. Soto", inst: "Edif. Atlas", hora: "07:15", desc: "Cámara sector B sin señal" },
    { tipo: "Sin novedad", urgencia: "verde", guardia: "J. García", inst: "Cond. Los Álamos", hora: "08:00", desc: "Ronda completada sin incidentes" },
  ];
  return (
    <div>
      <SectionHeader title="Novedades" sub="Ordenadas por prioridad" />
      {novedades.map((n, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          borderLeft: `4px solid ${n.urgencia === "rojo" ? T.red : n.urgencia === "amarillo" ? T.yellow : T.accent}`,
          padding: 14, marginBottom: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{n.tipo}</span>
            <Badge color={n.urgencia === "rojo" ? "red" : n.urgencia === "amarillo" ? "yellow" : "accent"}>{n.urgencia}</Badge>
          </div>
          <div style={{ fontSize: 12, color: T.textMut }}>{n.guardia} · {n.inst} · {n.hora}</div>
          <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>{n.desc}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Btn>Contactar</Btn>
            <Btn variant="ghost">Resolver</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

function SupSolicitudes() {
  const sols = [
    { guardia: "V. Norambuena", tipo: "Vacaciones", fechas: "21-25 Abr", estado: "Pendiente" },
    { guardia: "M. López", tipo: "Turno Extra", fechas: "13 Abr", estado: "Pendiente" },
  ];
  return (
    <div>
      <SectionHeader title="Solicitudes" sub="Pendientes de aprobación" />
      {sols.map((s, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, marginBottom: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{s.guardia}</span>
            <Badge color="yellow">{s.estado}</Badge>
          </div>
          <div style={{ fontSize: 12, color: T.textMut }}>{s.tipo}: {s.fechas}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Btn>Aprobar</Btn>
            <Btn variant="ghost">Rechazar</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

function SupGuardias() {
  return (
    <div>
      <SectionHeader title="Guardias" sub="Personal asignado a tus instalaciones" />
      {[
        { n: "V. Norambuena", rol: "Pauta", st: "Activo" },
        { n: "M. López", rol: "Pauta", st: "Activo" },
        { n: "J. García", rol: "Libre", st: "Activo" },
        { n: "R. Soto", rol: "Pauta", st: "Activo" },
        { n: "C. Muñoz", rol: "Pauta", st: "Ausente" },
      ].map((g, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 12, marginBottom: 5, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{g.n}</div>
            <div style={{ fontSize: 11, color: T.textMut }}>GGSS {g.rol}</div>
          </div>
          <Badge color={g.st === "Activo" ? "accent" : "red"}>{g.st}</Badge>
        </div>
      ))}
    </div>
  );
}

function SupReportes() {
  return (
    <div>
      <SectionHeader title="Reportes" sub="Genera informes operacionales" />
      {["Asistencia del Día", "Incidentes del Período", "Cumplimiento Rondas", "Exportar PDF", "Exportar Excel"].map((r, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, marginBottom: 6, display: "flex", justifyContent: "space-between",
          alignItems: "center", cursor: "pointer",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>{["📋", "🚨", "✅", "📑", "📊"][i]}</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{r}</span>
          </div>
          <span style={{ color: T.textMut, fontSize: 14 }}>→</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════ PANTALLAS BASE — ADMIN ═══════════════════

function AdminPanel() {
  return (
    <div>
      <SectionHeader title="Panel Central" sub="Vista general del sistema" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <KPI label="Guardias" value="127" sub="activos" accent="#B98CFF" />
        <KPI label="Instalaciones" value="23" sub="operativas" accent="#B98CFF" />
        <KPI label="Turnos Hoy" value="45" sub="programados" accent={T.accent} />
        <KPI label="Cobertura" value="96%" sub="mensual" accent={T.accent} />
      </div>
      <SubHeader title="Acciones Rápidas" />
      {["Crear Usuario", "Nueva Instalación", "Importar Turnos (Lote)", "Auditoría de Cambios", "Configuración"].map((a, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 13, marginBottom: 5, display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        }}>
          <span style={{ fontSize: 15 }}>{["👤", "🏢", "📥", "🔍", "⚙️"][i]}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{a}</span>
        </div>
      ))}
    </div>
  );
}

function AdminUsuarios() {
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

function AdminInstalaciones() {
  const insts = [
    { n: "Centro Comercial Arauco", tipo: "Comercial", criticidad: "Alta", tablet: true },
    { n: "Edificio Corp. Atlas", tipo: "Corporativo", criticidad: "Media", tablet: true },
    { n: "Condominio Los Álamos", tipo: "Residencial", criticidad: "Baja", tablet: true },
    { n: "Faena Industrial Norte", tipo: "Industrial", criticidad: "Alta", tablet: false },
  ];
  return (
    <div>
      <SectionHeader title="Instalaciones" sub="Recintos registrados en el sistema" action={{ label: "+ Nueva", onClick: () => {} }} />
      {insts.map((inst, i) => (
        <div key={i} style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, marginBottom: 6,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{inst.n}</span>
            <Badge color={inst.criticidad === "Alta" ? "red" : inst.criticidad === "Media" ? "yellow" : "accent"}>{inst.criticidad}</Badge>
          </div>
          <div style={{ fontSize: 12, color: T.textMut }}>
            {inst.tipo} · Tablet: {inst.tablet ? "✅ Instalada" : "❌ Pendiente"}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminTurnos() {
  return (
    <div>
      <SectionHeader title="Turnos" sub="Gestión masiva de horarios" action={{ label: "+ Crear Lote", onClick: () => {} }} />
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📥</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Importar Turnos</div>
        <div style={{ fontSize: 12, color: T.textMut, marginBottom: 14 }}>
          Sube un archivo CSV o Excel con los turnos programados
        </div>
        <Btn>Seleccionar Archivo</Btn>
      </div>
      <SubHeader title="Turnos Hoy (45)" />
      <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 20 }}>
        Conectar con GET /api/v1/turnos?fecha=hoy
      </div>
    </div>
  );
}

function AdminAuditoria() {
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

// ═══════════════════ SHARED UI ═══════════════════

function SectionHeader({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>{title}</h2>
        {sub && <div style={{ fontSize: 12, color: T.textMut, marginTop: 3 }}>{sub}</div>}
      </div>
      {action && (
        <button onClick={action.onClick} style={{
          background: T.accent, color: T.bg, border: "none", borderRadius: 10,
          padding: "8px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer",
          fontFamily: "'Outfit', sans-serif",
        }}>{action.label}</button>
      )}
    </div>
  );
}

function SubHeader({ title }) {
  return (
    <div style={{
      fontSize: 10, color: T.textMut, textTransform: "uppercase", letterSpacing: 1.5,
      fontWeight: 700, marginBottom: 8, marginTop: 16,
    }}>{title}</div>
  );
}

function Placeholder({ section }) {
  return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
      <div style={{ fontWeight: 700, fontSize: 16 }}>Sección: {section}</div>
      <div style={{ color: T.textMut, fontSize: 13, marginTop: 6 }}>
        Conectar con API backend en la siguiente fase
      </div>
    </div>
  );
}

// ═══════════════════ APP PRINCIPAL ═══════════════════

export default function GeoConstanzaApp() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const handleLogin = useCallback((u, t) => {
    setUser(u);
    setToken(t);
    // En producción: AsyncStorage.setItem("token", t);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setToken(null);
    // En producción: 
    // fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    // AsyncStorage.removeItem("token");
  }, [token]);

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <AuthCtx.Provider value={{ user, token, logout: handleLogout }}>
      <AppShell user={user} token={token} onLogout={handleLogout} />
    </AuthCtx.Provider>
  );
}
