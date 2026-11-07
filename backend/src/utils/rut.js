/**
 * RUT chileno: normalización y validación del dígito verificador (módulo 11).
 * Formato canónico de almacenamiento: cuerpo sin puntos, guion y dígito ("76543210-3").
 */

const limpiar = (rut) => String(rut ?? '').replace(/[.\s]/g, '').toUpperCase();

/** Dígito verificador de un cuerpo numérico ("76543210" -> "3"). */
const calcularDv = (cuerpo) => {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
};

/** Devuelve el RUT en formato canónico, o null si el formato o el dígito verificador son inválidos. */
const normalizarRut = (rut) => {
  const m = limpiar(rut).match(/^(\d{7,8})-?([\dK])$/);
  if (!m) return null;
  const [, cuerpo, dv] = m;
  return calcularDv(cuerpo) === dv ? `${cuerpo}-${dv}` : null;
};

const esRutValido = (rut) => normalizarRut(rut) !== null;

module.exports = { normalizarRut, esRutValido, calcularDv };
