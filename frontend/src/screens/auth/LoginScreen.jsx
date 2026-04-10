import { useState, useEffect } from "react";
import { T, ROLES } from "../../theme/theme";
import { api } from "../../services/api";
import { GlowOrb } from "../../components/ui/GlowOrb";
import { Input } from "../../components/ui/Input";
import { Btn } from "../../components/ui/Btn";

export function LoginScreen({ onLogin }) {
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
