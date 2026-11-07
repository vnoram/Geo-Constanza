const { cifrar, descifrar, hashSha256 } = require('../cifrado');

describe('cifrado AES-256-GCM', () => {
  const anterior = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  beforeEach(() => { process.env.TWO_FACTOR_ENCRYPTION_KEY = 'clave-de-prueba-solo-para-tests-0123456789'; });
  afterAll(() => { process.env.TWO_FACTOR_ENCRYPTION_KEY = anterior; });

  test('cifra y descifra sin dejar el texto plano en el resultado', () => {
    const valor = cifrar('JBSWY3DPEHPK3PXP');
    expect(valor.startsWith('v1.')).toBe(true);
    expect(valor).not.toContain('JBSWY3DPEHPK3PXP');
    expect(descifrar(valor)).toBe('JBSWY3DPEHPK3PXP');
  });

  test('el mismo texto cifra distinto cada vez (IV aleatorio)', () => {
    expect(cifrar('igual')).not.toBe(cifrar('igual'));
  });

  test('detecta manipulación del texto cifrado', () => {
    const [v, iv, tag] = cifrar('secreto').split('.');
    const alterado = [v, iv, tag, Buffer.from('otro-dato').toString('base64url')].join('.');
    expect(() => descifrar(alterado)).toThrow();
    expect(() => descifrar('formato-invalido')).toThrow(/formato/i);
  });

  test('una clave distinta no puede descifrar', () => {
    const valor = cifrar('secreto');
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'otra-clave-completamente-distinta-9876543210';
    expect(() => descifrar(valor)).toThrow();
  });

  test('sin clave configurada falla con error claro', () => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = '';
    expect(() => cifrar('x')).toThrow(/TWO_FACTOR_ENCRYPTION_KEY/);
  });

  test('acepta clave de 64 caracteres hexadecimales', () => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'ab'.repeat(32);
    expect(descifrar(cifrar('hex'))).toBe('hex');
  });

  test('hashSha256 es determinista', () => {
    expect(hashSha256('a')).toBe(hashSha256('a'));
    expect(hashSha256('a')).not.toBe(hashSha256('b'));
  });
});
