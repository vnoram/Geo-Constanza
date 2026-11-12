import { API_URL as API_BASE } from "../config/api";
import { leerSesion } from "../services/almacenSesion";

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
  return leerSesion(TOKEN_KEY);
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
  confirmarInvitacionDispositivo: (token) => request('/dispositivos/invitaciones/confirmar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
  }),
  canjearDispositivo: (codigo) => request('/dispositivos/canjear', {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo }),
  }),
  // ── Auth (sin token) ──────────────────────────────────────────
  login: async (rut, password, invitacion) => {
    const data = await request('/auth/login', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut, password, invitacion: invitacion || undefined }),
    });
    // Con 2FA exigido el backend responde { requires2FA, tempToken } sin tokens de sesión.
    if (data.requires2FA) {
      return { requires2FA: true, tempToken: data.tempToken, method: data.method, retryAfter: data.retryAfter };
    }
    // Backend devuelve { usuario, accessToken, refreshToken[, mustEnroll2FA] }
    return {
      user: data.usuario,
      token: data.accessToken,
      refreshToken: data.refreshToken,
      mustEnroll2FA: Boolean(data.mustEnroll2FA),
      tokenDispositivo: data.tokenDispositivo,
    };
  },

  // Segundo paso del login: código TOTP de 6 dígitos o código de recuperación.
  verify2FA: async (tempToken, code) => {
    const data = await request('/auth/2fa/verify', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempToken, code }),
    });
    return { user: data.usuario, token: data.accessToken, refreshToken: data.refreshToken, tokenDispositivo: data.tokenDispositivo };
  },

  // Restablecer contraseña (público): la respuesta es la misma exista o no el correo.
  requestPasswordReset: (email) => request('/auth/password/reset-request', {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
  }),
  confirmPasswordReset: (token, password) => request('/auth/password/reset-confirm', {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }),
  }),

  // Mi cuenta (requiere sesión): cambia la contraseña propia.
  cambiarPassword: (actual, nueva) => authFetch('/auth/password/change', {
    method: "POST", body: JSON.stringify({ actual, nueva }),
  }),

  // Enrolamiento (requiere sesión): devuelve { otpauth_url, secreto }.
  resend2FA: (tempToken) => request('/auth/2fa/resend', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tempToken }),
  }),

  setup2FA: () => authFetch('/auth/2fa/setup', { method: "POST", body: JSON.stringify({}) }),
  // Confirma con un código y devuelve { codigos_recuperacion } (se muestran una sola vez).
  enable2FA: (code) => authFetch('/auth/2fa/enable', { method: "POST", body: JSON.stringify({ code }) }),

  // ── Peticiones autenticadas (con Bearer token) ────────────────
  get:   (path)        => authFetch(path),
  post:  (path, body)  => authFetch(path, { method: "POST",   body: JSON.stringify(body) }),
  put:   (path, body)  => authFetch(path, { method: "PUT",    body: JSON.stringify(body) }),
  patch: (path, body)  => authFetch(path, { method: "PATCH",  body: JSON.stringify(body) }),
  del:   (path)        => authFetch(path, { method: "DELETE" }),
};
