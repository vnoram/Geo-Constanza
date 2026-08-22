if (!import.meta.env.VITE_API_URL && import.meta.env.PROD) {
  console.error('[api] VITE_API_URL no está definida en el build de producción. Las peticiones al backend fallarán.');
}
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");
const API_BASE = configuredApiUrl
  ? (configuredApiUrl.endsWith("/api/v1") ? configuredApiUrl : `${configuredApiUrl}/api/v1`)
  : "http://localhost:3005/api/v1";
const TOKEN_KEY   = "gc_token";

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new ApiError("No se pudo conectar con el servidor. Verifica que el backend esté activo", 0);
  }

  const body = await res.text();
  let data = {};
  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      throw new ApiError(
        `El servidor respondió en un formato inválido (HTTP ${res.status})`,
        res.status,
      );
    }
  }

  if (!res.ok) {
    throw new ApiError(data.error || data.message || `Error del servidor (HTTP ${res.status})`, res.status);
  }

  if (!body) {
    throw new ApiError(`El servidor devolvió una respuesta vacía (HTTP ${res.status})`, res.status);
  }

  return data;
}

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
  return request(path, { ...options, headers });
}

// ─── API ─────────────────────────────────────────────────────────
export const api = {
  // ── Auth (sin token) ──────────────────────────────────────────
  login: async (rut, password) => {
    const data = await request('/auth/login', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut, password }),
    });
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
