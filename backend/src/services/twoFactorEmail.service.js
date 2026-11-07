const { createHmac, randomInt, randomUUID, timingSafeEqual } = require('crypto');
const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config/jwt');
const { getRedis } = require('../config/redis');
const { registrarAuditoria } = require('../middlewares/auditLog');
const { enviarCorreo } = require('./correo.service');

const DURACION = 600;
const ESPERA = 60;
const MAX_INTENTOS = 5;
const MAX_REENVIOS = 3;
const memoria = new Map();
const clave = () => createHmac('sha256', jwtConfig.accessSecret).update('geo:2fa:email:v1').digest();
const hash = (valor) => createHmac('sha256', clave()).update(valor).digest('hex');
const error = (statusCode, mensaje, code) => Object.assign(new Error(mensaje), { statusCode, code });
const invalido = () => error(401, 'Código o desafío inválido.');
const noDisponible = () => error(503, 'Verificación temporalmente no disponible.');
const ahora = () => Math.floor(Date.now() / 1000);
const huella = (u) => hash(JSON.stringify([u.id, u.rol, u.empresa_id, u.email, u.password_hash]));
const habilitado = () => process.env.TWO_FACTOR_METHOD?.trim().toLowerCase() === 'email';
const exigido = () => {
  const valor = process.env.REQUIRE_2FA?.trim().toLowerCase();
  return valor === 'true' || (valor !== 'false' && process.env.NODE_ENV === 'production');
};

const obtenerDesafio = (tempToken) => {
  try {
    const payload = jwt.verify(tempToken, clave(), { algorithms: ['HS256'] });
    if (payload.tipo === '2fa_pending' && payload.metodo === 'email' && payload.jti) return payload;
  } catch (_) { /* Desafío inválido o vencido. */ }
  throw invalido();
};

const CAMBIAR = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
  if ARGV[2] == '' then redis.call('DEL', KEYS[1])
  else redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL') end
  return 1`;

const almacen = (desafio) => {
  const key = `2fa_email:${desafio.jti}`;
  const redis = getRedis();
  if (!redis && process.env.REDIS_URL?.trim()) throw noDisponible();
  const operar = async (operacion) => {
    let timeout;
    try {
      return await Promise.race([
        operacion(),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(noDisponible()), 2000); }),
      ]);
    } catch (_) { throw noDisponible(); }
    finally { clearTimeout(timeout); }
  };
  if (redis) return {
    crear: (valor) => operar(() => redis.set(key, valor, 'EX', Math.max(1, desafio.exp - ahora()))),
    leer: () => operar(() => redis.get(key)),
    cambiar: async (anterior, siguiente) => Number(await operar(() => redis.eval(CAMBIAR, 1, key, anterior, siguiente))) === 1,
  };

  for (const [id, valor] of memoria) if (valor.exp <= ahora()) memoria.delete(id);
  return {
    crear: (valor) => memoria.set(key, { valor, exp: desafio.exp }),
    leer: () => memoria.get(key)?.valor,
    cambiar: (anterior, siguiente) => {
      if (desafio.exp <= ahora() || memoria.get(key)?.valor !== anterior) return false;
      if (siguiente) memoria.set(key, { valor: siguiente, exp: desafio.exp });
      else memoria.delete(key);
      return true;
    },
  };
};

const auditar = (usuario, accion, contexto) => registrarAuditoria({
  usuarioId: usuario.id, empresaId: usuario.empresa_id, accion,
  tablaAfectada: 'usuarios', registroId: usuario.id, ...contexto,
});

const generarCodigo = (desafio, hashAnterior) => {
  let codigo, hashNuevo;
  do {
    codigo = String(randomInt(1000000)).padStart(6, '0');
    hashNuevo = hash(`${desafio.jti}:${codigo}`);
  } while (hashNuevo === hashAnterior);
  return { codigo, hashNuevo };
};

const enviar = async (usuario, codigo, datos, store, contexto) => {
  const texto = `Tu código de Geo Constanza es ${codigo}. Vence 10 minutos después de iniciar sesión. Si no lo solicitaste, ignora este correo.`;
  const pendiente = JSON.stringify(datos);
  let enviado = false;
  try {
    enviado = await enviarCorreo(usuario.email, 'Código de acceso - Geo Constanza', undefined, texto, { soloSMTP: true });
  } catch (_) { /* El error público no contiene detalles del proveedor. */ }
  if (!enviado) {
    await store.cambiar(pendiente, '');
    throw error(503, 'No pudimos enviar el código de acceso. Intenta iniciar sesión de nuevo.', 'EMAIL_2FA_ENVIO');
  }
  if (!await store.cambiar(pendiente, JSON.stringify({ ...datos, enviando: false }))) throw invalido();
  await auditar(usuario, 'enviar_2fa_email', contexto);
  return { retryAfter: Math.max(0, datos.reenvioDesde - ahora()) };
};

const iniciar = async (usuario, contexto) => {
  const desafio = { id: usuario.id, tipo: '2fa_pending', metodo: 'email', jti: randomUUID(), exp: ahora() + DURACION };
  const store = almacen(desafio);
  const { codigo, hashNuevo } = generarCodigo(desafio);
  const datos = { usuario: huella(usuario), intentos: 0, reenvios: 0, reenvioDesde: ahora() + ESPERA, hash: hashNuevo, enviando: true };
  await store.crear(JSON.stringify(datos));
  const resultado = await enviar(usuario, codigo, datos, store, contexto);
  return { requires2FA: true, method: 'email', tempToken: jwt.sign(desafio, clave(), { algorithm: 'HS256' }), ...resultado };
};

const verificar = async (usuario, desafio, codigo, contexto) => {
  const store = almacen(desafio);
  while (desafio.exp > ahora()) {
    const anterior = await store.leer();
    const datos = anterior && JSON.parse(anterior);
    if (!datos || datos.enviando || datos.usuario !== huella(usuario)) break;
    const coincide = /^\d{6}$/.test(codigo) && timingSafeEqual(
      Buffer.from(datos.hash, 'hex'), Buffer.from(hash(`${desafio.jti}:${codigo}`), 'hex'),
    );
    datos.intentos += 1;
    const siguiente = coincide || datos.intentos >= MAX_INTENTOS ? '' : JSON.stringify(datos);
    if (!await store.cambiar(anterior, siguiente)) continue;
    if (coincide) return;
    break;
  }
  await auditar(usuario, 'fallo_2fa_email', contexto);
  throw invalido();
};

const reenviar = async (usuario, desafio, contexto) => {
  const store = almacen(desafio);
  const anterior = await store.leer();
  const datos = anterior && JSON.parse(anterior);
  if (!datos || datos.usuario !== huella(usuario)) throw invalido();
  if (datos.enviando || datos.reenvioDesde > ahora() || datos.reenvios >= MAX_REENVIOS) {
    throw error(429, 'No se puede reenviar el código en este momento.');
  }
  const { codigo, hashNuevo } = generarCodigo(desafio, datos.hash);
  const siguiente = { ...datos, reenvios: datos.reenvios + 1, reenvioDesde: ahora() + ESPERA, hash: hashNuevo, enviando: true };
  if (!await store.cambiar(anterior, JSON.stringify(siguiente))) throw error(429, 'No se puede reenviar el código en este momento.');
  return enviar(usuario, codigo, siguiente, store, contexto);
};

module.exports = { habilitado, exigido, obtenerDesafio, iniciar, verificar, reenviar };
