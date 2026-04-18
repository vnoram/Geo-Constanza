const API_BASE    = import.meta.env.VITE_API_URL || "http://localhost:3005/api/v1";
const TOKEN_KEY   = "gc_token";

// ─── TOKEN HELPER ───────────────────────────────────────────────
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// ─── AUTHENTICATED FETCH ────────────────────────────────────────
// Todas las peticiones privadas pasan por aquí; inyecta el Bearer automáticamente.
async function authFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res  = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ─── API ─────────────────────────────────────────────────────────
export const api = {
  // ── Auth (sin token) ──────────────────────────────────────────
  login: async (rut, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Credenciales inválidas");
    // Guardia: si el backend devuelve requires2FA antes de que esté implementado
    // en el frontend, lanzamos un error claro en lugar de crashear con TypeError.
    if (data.requires2FA) {
      throw new Error("2FA requerido por el servidor pero no implementado aún. Contacta al administrador.");
    }
    // Backend devuelve { usuario, accessToken, refreshToken }
    return {
      user: data.usuario,
      token: data.accessToken,
      refreshToken: data.refreshToken,
    };
  },

  verify2FA: async (code) => {
    await new Promise(r => setTimeout(r, 800));
    if (code === "123456") return { verified: true };
    throw new Error("Código 2FA inválido");
  },

  // ── Peticiones autenticadas (con Bearer token) ────────────────
  get:   (path)        => authFetch(path),
  post:  (path, body)  => authFetch(path, { method: "POST",   body: JSON.stringify(body) }),
  put:   (path, body)  => authFetch(path, { method: "PUT",    body: JSON.stringify(body) }),
  patch: (path, body)  => authFetch(path, { method: "PATCH",  body: JSON.stringify(body) }),
  del:   (path)        => authFetch(path, { method: "DELETE" }),
};
