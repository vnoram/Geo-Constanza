const CLAVE = "gc_device_token";

export function leerDeviceToken() {
  try { return localStorage.getItem(CLAVE); } catch { return null; }
}

export function guardarDeviceToken(token) {
  localStorage.setItem(CLAVE, token);
}
