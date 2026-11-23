#!/usr/bin/env node
/**
 * Medición de los KPI del informe contra un entorno desplegado (idealmente de PRUEBAS, no el de producción real):
 *   KPI-1  Validación de geocerca: POST /asistencia/entrada-fallback responde en < 3 s.
 *   KPI-2  Alerta crítica: desde que el guardia envía una novedad roja hasta que el operador central
 *          recibe el evento `alerta_critica_central` por Socket.IO en < 5 s.
 * Mide el tiempo completo desde el cliente (incluye la red), así que es el tiempo que vería el usuario.
 * NO inventa nada: si una medición falla se cuenta como error y se informa.
 *
 * ⚠ CREA DATOS: una asistencia por guardia (KPI-1) y novedades rojas "[KPI]" (KPI-2). Úsalo con guardias de prueba.
 *
 * Requisitos para que mida algo válido:
 *   - Cada guardia en KPI_GUARDIAS tiene un turno vigente AHORA (entrada permitida desde 15 min antes) y sin entrada abierta.
 *   - Para KPI-2, la instalación de ese turno tiene criticidad "Alta" y el guardia está dentro de su turno.
 *   - Operador central sin 2FA (solo supervisor/admin lo exigen). Con DEVICE_POLICY=on hace falta un equipo enrolado: no soportado aquí.
 *
 * Variables de entorno (los secretos NO van como argumentos, para que no queden en el historial):
 *   KPI_API_URL            https://<api>      (sin barra final; sin /api/v1)
 *   KPI_GUARDIAS           rut1:clave1,rut2:clave2,...   guardias de prueba
 *   KPI_CENTRAL_RUT / KPI_CENTRAL_PASSWORD    operador central de la misma empresa
 *   KPI_LAT / KPI_LON      coordenadas DENTRO de la geocerca de la instalación de esos guardias
 *
 * Uso:
 *   node scripts/medicion-kpi.js --confirmo-datos-de-prueba [--alertas 20] [--salida resultados-kpi]
 * Guarda <salida>/kpi-<fecha>.json y .md con n, errores, mín, p50, p95, p99, máx y el veredicto contra el umbral.
 */
const fs = require('fs');
const path = require('path');

const UMBRAL_GEOCERCA_MS = 3000;
const UMBRAL_ALERTA_MS = 5000;

/** Percentil por rango más cercano (nearest-rank) sobre una lista de números. */
function percentil(valores, p) {
  if (!valores.length) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const rango = Math.max(1, Math.ceil((p / 100) * orden.length));
  return orden[rango - 1];
}

function resumir(nombre, tiempos, errores, umbralMs) {
  const r = {
    kpi: nombre, umbral_ms: umbralMs, n_ok: tiempos.length, n_error: errores.length, errores: errores.slice(0, 10),
    min_ms: tiempos.length ? Math.min(...tiempos) : null, p50_ms: percentil(tiempos, 50), p95_ms: percentil(tiempos, 95),
    p99_ms: percentil(tiempos, 99), max_ms: tiempos.length ? Math.max(...tiempos) : null,
    bajo_umbral_pct: tiempos.length ? Math.round((tiempos.filter((t) => t < umbralMs).length / tiempos.length) * 1000) / 10 : null,
  };
  // Con menos de 20 muestras el p95/p99 coinciden con el máximo: se avisa en vez de aparentar precisión.
  r.muestra_pequena = tiempos.length < 20;
  r.cumple = tiempos.length > 0 && errores.length === 0 && r.p95_ms < umbralMs;
  return r;
}

const aMarkdown = (meta, resultados) => [
  `# Medición de KPI — ${meta.fecha}`, '', `Entorno: ${meta.api} · cliente: ${meta.cliente}`, '',
  '| KPI | Umbral | n ok | errores | mín | p50 | p95 | p99 | máx | % bajo umbral | Cumple (p95 < umbral, 0 errores) |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
  ...resultados.map((r) => `| ${r.kpi} | ${r.umbral_ms} ms | ${r.n_ok} | ${r.n_error} | ${r.min_ms} | ${r.p50_ms} | ${r.p95_ms} | ${r.p99_ms} | ${r.max_ms} | ${r.bajo_umbral_pct} | ${r.cumple ? 'sí' : 'NO'}${r.muestra_pequena ? ' (muestra < 20)' : ''} |`),
  '', 'Tiempos en milisegundos, medidos desde el cliente (incluyen la red). Con muestra pequeña p95 y p99 equivalen al máximo.', '',
].join('\n');

async function main() {
  const args = process.argv.slice(2);
  const val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  if (!args.includes('--confirmo-datos-de-prueba')) throw new Error('Este script crea asistencias y novedades. Agrega --confirmo-datos-de-prueba si es un entorno de pruebas.');
  const api = (process.env.KPI_API_URL || '').replace(/\/$/, '');
  const guardias = (process.env.KPI_GUARDIAS || '').split(',').filter(Boolean).map((p) => { const [rut, ...c] = p.split(':'); return { rut, password: c.join(':') }; });
  const { KPI_CENTRAL_RUT: centralRut, KPI_CENTRAL_PASSWORD: centralPass, KPI_LAT: lat, KPI_LON: lon } = process.env;
  if (!api || !guardias.length || !centralRut || !centralPass || !lat || !lon) throw new Error('Faltan variables: KPI_API_URL, KPI_GUARDIAS, KPI_CENTRAL_RUT, KPI_CENTRAL_PASSWORD, KPI_LAT, KPI_LON.');
  const nAlertas = Number(val('--alertas', 20));
  const salida = val('--salida', 'resultados-kpi');
  const { io } = require('socket.io-client');

  const http = async (ruta, token, cuerpo) => {
    const t0 = performance.now();
    const res = await fetch(`${api}/api/v1${ruta}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(cuerpo) });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json, ms: performance.now() - t0, t0 };
  };
  const login = async (rut, password) => {
    const r = await http('/auth/login', null, { rut, password });
    if (!r.ok || !r.json.accessToken) throw new Error(`Login fallido para ${rut}: HTTP ${r.status}${r.json.requires2FA ? ' (pide 2FA: usa un usuario sin 2FA)' : ''}`);
    return r.json.accessToken;
  };

  const sesiones = [];
  for (const g of guardias) sesiones.push({ ...g, token: await login(g.rut, g.password) });
  const tokenCentral = await login(centralRut, centralPass);
  const coords = { latitud: Number(lat), longitud: Number(lon), precision_m: 10 };

  // KPI-1: una entrada por guardia (la segunda del mismo turno devuelve la abierta y no valida de nuevo).
  const tiempos1 = []; const errores1 = [];
  for (const s of sesiones) {
    const turno = await fetch(`${api}/api/v1/turnos`, { headers: { Authorization: `Bearer ${s.token}` } }).then((r) => r.json()).catch(() => null);
    const lista = Array.isArray(turno) ? turno : (turno?.data || []);
    const instalacion_id = (lista.find((t) => t.estado !== 'cancelado') || {}).instalacion_id;
    if (!instalacion_id) { errores1.push(`${s.rut}: sin turno para tomar la instalación`); continue; }
    s.instalacion_id = instalacion_id;
    const r = await http('/asistencia/entrada-fallback', s.token, { instalacion_id, ...coords });
    if (r.ok) tiempos1.push(Math.round(r.ms)); else errores1.push(`${s.rut}: HTTP ${r.status} ${r.json.error || r.json.message || ''}`.trim());
  }

  // KPI-2: novedad roja del guardia → evento al operador central.
  const tiempos2 = []; const errores2 = [];
  const socket = io(api, { auth: { token: tokenCentral }, transports: ['websocket'], reconnection: false });
  await new Promise((ok, mal) => { socket.on('connect', ok); socket.on('connect_error', (e) => mal(new Error(`Socket del central: ${e.message}`))); });
  const esperas = new Map();
  socket.on('alerta_critica_central', (e) => { const f = esperas.get(e.id); if (f) f(performance.now()); });
  for (let i = 0; i < nAlertas; i += 1) {
    const s = sesiones[i % sesiones.length];
    const t0 = performance.now();
    const r = await http('/novedades', s.token, { tipo: 'Robo', descripcion: `[KPI] medición de alerta ${i + 1}`, ...coords });
    const id = r.json?.id || r.json?.data?.id || r.json?.novedad?.id;
    if (!r.ok || !id) { errores2.push(`${s.rut}: HTTP ${r.status} ${r.json.error || r.json.message || ''}`.trim()); continue; }
    const llegada = await new Promise((ok) => { esperas.set(id, ok); setTimeout(() => ok(null), 15000); });
    esperas.delete(id);
    if (llegada) tiempos2.push(Math.round(llegada - t0)); else errores2.push(`${s.rut}: la alerta ${id} no llegó en 15 s (¿instalación con criticidad Alta?)`);
  }
  socket.close();

  const resultados = [
    resumir('KPI-1 Geocerca (POST /asistencia/entrada-fallback)', tiempos1, errores1, UMBRAL_GEOCERCA_MS),
    resumir('KPI-2 Alerta crítica (novedad roja → central)', tiempos2, errores2, UMBRAL_ALERTA_MS),
  ];
  const meta = { fecha: new Date().toISOString(), api, cliente: `${process.platform} node ${process.version}` };
  fs.mkdirSync(salida, { recursive: true });
  const base = path.join(salida, `kpi-${meta.fecha.replace(/[:.]/g, '-')}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify({ meta, resultados, muestras_ms: { geocerca: tiempos1, alerta: tiempos2 } }, null, 2));
  fs.writeFileSync(`${base}.md`, aMarkdown(meta, resultados));
  console.log(aMarkdown(meta, resultados));
  console.log(`Guardado en ${base}.json y ${base}.md`);
}

module.exports = { percentil, resumir, UMBRAL_GEOCERCA_MS, UMBRAL_ALERTA_MS };

if (require.main === module) main().then(() => process.exit(0), (e) => { console.error(`Error: ${e.message}`); process.exit(1); });
