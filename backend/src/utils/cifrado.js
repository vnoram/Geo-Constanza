// Cifrado simétrico AES-256-GCM para datos sensibles en reposo (p. ej. secreto TOTP).
// Formato almacenado: v1.<iv base64url>.<tag base64url>.<texto cifrado base64url>
const crypto = require('crypto');

const ALGORITMO = 'aes-256-gcm';

const obtenerClave = () => {
  const bruta = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  if (!bruta || !bruta.trim()) {
    throw Object.assign(new Error('Cifrado de 2FA no configurado (falta TWO_FACTOR_ENCRYPTION_KEY).'), { statusCode: 500 });
  }
  // Acepta 64 hex (32 bytes) o cualquier texto largo, derivado con SHA-256.
  return /^[0-9a-fA-F]{64}$/.test(bruta.trim())
    ? Buffer.from(bruta.trim(), 'hex')
    : crypto.createHash('sha256').update(bruta).digest();
};

const cifrar = (textoPlano) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITMO, obtenerClave(), iv);
  const cifrado = Buffer.concat([cipher.update(String(textoPlano), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), cifrado.toString('base64url')].join('.');
};

const descifrar = (valor) => {
  const [version, iv, tag, cifrado] = String(valor || '').split('.');
  if (version !== 'v1' || !iv || !tag || !cifrado) {
    throw Object.assign(new Error('Secreto 2FA con formato inválido.'), { statusCode: 500 });
  }
  const decipher = crypto.createDecipheriv(ALGORITMO, obtenerClave(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(cifrado, 'base64url')), decipher.final()]).toString('utf8');
};

const hashSha256 = (texto) => crypto.createHash('sha256').update(String(texto)).digest('hex');

module.exports = { cifrar, descifrar, hashSha256 };
