#!/usr/bin/env node
/**
 * Verifica la configuración de 2FA, correo (SMTP) y push (Firebase) SIN imprimir ningún secreto.
 * Solo dice si cada variable está definida y si la conexión funciona.
 *
 *   node scripts/verificar-config.js                      # revisa variables + prueba cifrado 2FA + conexión SMTP + credenciales FCM
 *   node scripts/verificar-config.js --enviar-a yo@correo.cl      # además envía un correo de prueba
 *   node scripts/verificar-config.js --token-fcm <token>          # además envía un push real a ese token
 *   node scripts/verificar-config.js --omitir-red                 # solo revisa variables (sin conectarse a nada)
 *
 * En Azure: az containerapp exec -n <app> -g <grupo> --command "node scripts/verificar-config.js"
 * (en local, con Docker: docker compose exec api node scripts/verificar-config.js)
 */
require('dotenv').config();

const args = process.argv.slice(2);
const valor = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const omitirRed = args.includes('--omitir-red');
const resultados = [];
const registrar = (area, estado, detalle) => {
  resultados.push({ area, estado });
  const marca = { ok: 'OK   ', falta: 'FALTA', error: 'ERROR', aviso: 'AVISO' }[estado];
  console.log(`[${marca}] ${area}: ${detalle}`);
};
const definida = (n) => Boolean((process.env[n] || '').trim());

const verificarVariables = () => {
  const obligatoriasProd = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'FRONTEND_URL', 'AZURE_STORAGE_CONNECTION_STRING'];
  for (const n of obligatoriasProd) registrar('Variable', definida(n) ? 'ok' : 'falta', `${n} ${definida(n) ? 'definida' : 'NO definida'}`);
  console.log(`       NODE_ENV=${process.env.NODE_ENV || '(sin definir)'} · REQUIRE_2FA=${process.env.REQUIRE_2FA || '(sin definir)'} · TWO_FACTOR_METHOD=${process.env.TWO_FACTOR_METHOD || 'totp'} · DEVICE_POLICY=${process.env.DEVICE_POLICY || 'off'}`);
  if ((process.env.DEVICE_POLICY || 'off') !== 'on') registrar('Fuera de geocerca (HU-15)', 'aviso', 'DEVICE_POLICY no es "on": el marcaje fuera de geocerca se rechaza en vez de quedar por revisar.');
};

const verificar2FA = () => {
  if (!definida('TWO_FACTOR_ENCRYPTION_KEY')) return registrar('2FA', 'falta', 'TWO_FACTOR_ENCRYPTION_KEY no definida: con REQUIRE_2FA activo el 2FA se desactiva solo.');
  try {
    const cifrado = require('../src/utils/cifrado');
    const cifrar = cifrado.cifrar || cifrado.encrypt;
    const descifrar = cifrado.descifrar || cifrado.decrypt;
    if (descifrar(cifrar('prueba-2fa')) !== 'prueba-2fa') throw new Error('el texto descifrado no coincide');
    registrar('2FA', 'ok', 'clave de cifrado válida (cifrado y descifrado de prueba correctos).');
  } catch (e) { registrar('2FA', 'error', `la clave no sirve para cifrar: ${e.message}`); }
};

const verificarSMTP = async () => {
  const faltan = ['SMTP_HOST', 'MAIL_FROM'].filter((n) => !definida(n));
  if (faltan.length) return registrar('SMTP', 'falta', `faltan ${faltan.join(', ')} (SMTP_PORT=${process.env.SMTP_PORT || '587 por defecto'}, SMTP_USER ${definida('SMTP_USER') ? 'definido' : 'no definido'})`);
  if (omitirRed) return registrar('SMTP', 'ok', 'variables presentes (no se probó la conexión).');
  const nodemailer = require('nodemailer');
  const puerto = parseInt(process.env.SMTP_PORT, 10) || 587;
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: puerto, secure: puerto === 465, connectionTimeout: 10000,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  try { await t.verify(); registrar('SMTP', 'ok', 'conexión y autenticación correctas con el servidor de correo.'); } catch (e) { return registrar('SMTP', 'error', `no se pudo conectar/autenticar (${e.code || e.message})`); }
  const destino = valor('--enviar-a');
  if (destino) {
    try { await t.sendMail({ from: process.env.MAIL_FROM, to: destino, subject: 'Prueba de correo Geo Constanza', text: 'Si lees esto, el SMTP de Geo Constanza funciona.' }); registrar('SMTP envío', 'ok', `correo de prueba enviado a ${destino}.`); } catch (e) { registrar('SMTP envío', 'error', `falló el envío (${e.code || e.message})`); }
  }
};

const verificarFirebase = async () => {
  const faltan = ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'].filter((n) => !definida(n));
  if (faltan.length) return registrar('Firebase', 'falta', `faltan ${faltan.join(', ')}`);
  if (omitirRed) return registrar('Firebase', 'ok', 'variables presentes (no se probaron las credenciales).');
  const { initFirebase } = require('../src/config/firebase');
  const firebase = initFirebase();
  if (!firebase) return registrar('Firebase', 'error', 'las credenciales no inicializan (revisa el formato de FIREBASE_PRIVATE_KEY, con \\n literales).');
  const tokenReal = valor('--token-fcm');
  try {
    // Sin token real se hace un envío de validación (dryRun) con un token falso: si las credenciales son malas, falla por autenticación.
    await firebase.messaging().send({ token: tokenReal || 'token-de-prueba-invalido', notification: { title: 'Geo Constanza', body: 'Prueba de push' } }, !tokenReal);
    registrar('Firebase', 'ok', tokenReal ? 'push enviado al token indicado.' : 'credenciales aceptadas por Firebase.');
  } catch (e) {
    const code = e.code || '';
    if (/invalid-argument|registration-token-not-registered|invalid-registration-token/.test(code) && !tokenReal) registrar('Firebase', 'ok', `credenciales aceptadas por Firebase (el token falso se rechazó como se esperaba: ${code}).`);
    else registrar('Firebase', 'error', `Firebase rechazó la operación (${code || e.message})`);
  }
};

(async () => {
  verificarVariables();
  verificar2FA();
  await verificarSMTP();
  await verificarFirebase();
  const mal = resultados.filter((r) => r.estado === 'error' || r.estado === 'falta').length;
  console.log(mal ? `\n${mal} punto(s) por resolver.` : '\nTodo en orden.');
  process.exit(mal ? 1 : 0);
})();
