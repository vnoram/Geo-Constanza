import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { AppShell } from "./components/layout/AppShell";

// ═══════════════════════════════════════════════════════════════
// GEO CONSTANZA — FASE 1: AUTENTICACIÓN + PERSISTENCIA DE SESIÓN
// ═══════════════════════════════════════════════════════════════

// AppRouter decide qué renderizar según el estado de autenticación.
// Espera a `ready` para que AuthProvider restaure la sesión desde
// localStorage antes de mostrar cualquier pantalla.
function AppRouter() {
  const { user, token, login, logout, ready } = useAuth();

  if (!ready) return null;   // Evita flash de /login durante la hidratación

  if (!user) {
    return <LoginScreen onLogin={login} />;
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
