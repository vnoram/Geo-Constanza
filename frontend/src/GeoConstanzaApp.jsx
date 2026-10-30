import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { Enroll2FAScreen } from "./screens/auth/Enroll2FAScreen";
import { ResetPasswordScreen } from "./screens/auth/ResetPasswordScreen";
import { AppShell } from "./components/layout/AppShell";

// ═══════════════════════════════════════════════════════════════
// GEO CONSTANZA — FASE 1: AUTENTICACIÓN + PERSISTENCIA DE SESIÓN
// ═══════════════════════════════════════════════════════════════

// AppRouter decide qué renderizar según el estado de autenticación.
// Espera a `ready` para que AuthProvider restaure la sesión desde
// localStorage antes de mostrar cualquier pantalla.
function AppRouter() {
  const { user, token, login, logout, ready } = useAuth();
  // /restablecer?token=... llega desde el correo; sin token es la solicitud del enlace.
  const [restablecer, setRestablecer] = useState(() => window.location.pathname === "/restablecer");
  const volverAlLogin = () => { window.history.replaceState(null, "", "/"); setRestablecer(false); };

  if (!ready) return null;   // Evita flash de /login durante la hidratación

  if (!user && restablecer) {
    const tokenUrl = new URLSearchParams(window.location.search).get("token");
    return <ResetPasswordScreen token={tokenUrl} onBack={volverAlLogin} />;
  }

  if (!user) {
    return <LoginScreen onLogin={login} onForgot={() => setRestablecer(true)} />;
  }

  if (user.mustEnroll2FA) {
    const { mustEnroll2FA, ...usuario } = user; // eslint-disable-line no-unused-vars
    return <Enroll2FAScreen onDone={() => login({ ...usuario, segundoFactor: true }, localStorage.getItem("gc_token") || token)} onLogout={logout} />;
  }

  return <AppShell user={user} token={token} onLogout={logout} />;
}

export default function GeoConstanzaApp() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
