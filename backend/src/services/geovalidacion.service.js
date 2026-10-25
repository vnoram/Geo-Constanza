/**
 * Servicio de Validación Geográfica - Geo Constanza
 */

// Función interna: Calcula la distancia en metros entre dos puntos GPS
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radio de la Tierra en metros (constante fundamental)
  
  // Convertir grados a radianes
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  // Fórmula de Haversine
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanciaMetros = R * c;
  return distanciaMetros;
}

/**
 * Valida si un guardia está dentro del radio permitido de la instalación
 * @param {number} latGuardia - Latitud del celular del guardia
 * @param {number} lonGuardia - Longitud del celular del guardia
 * @param {number} latInstalacion - Latitud del punto de marcaje (ej. Portería)
 * @param {number} lonInstalacion - Longitud del punto de marcaje
 * @param {number} radioPermitido - Metros de holgura (por defecto 50 metros)
 * @returns {object} Objeto con el resultado de la validación
 */
function validarAsistencia(latGuardia, lonGuardia, latInstalacion, lonInstalacion, radioPermitido = 50, precisionM = null) {
  const distancia = calcularDistancia(latGuardia, lonGuardia, latInstalacion, lonInstalacion);
  const distanciaMetros = Math.round(distancia);
  const precision = precisionM === null || precisionM === '' ? NaN : Number(precisionM);
  const precisionValida = Number.isFinite(precision) && precision >= 0
    ? Math.round(precision)
    : null;
  const esValido = distancia <= radioPermitido;
  const detallePrecision = precisionValida === null
    ? ''
    : ` La precisión de tu ubicación es de ±${precisionValida} m.`;
  const advertenciaPrecision = precisionValida !== null && precisionValida > radioPermitido
    ? ' Tu ubicación es imprecisa; usa un dispositivo con GPS.'
    : '';

  return {
    esValido,
    distanciaMetros,
    mensaje: esValido
      ? `Marcaje válido. Estás a ${distanciaMetros} m de la instalación (máximo permitido: ${radioPermitido} m).${detallePrecision}${advertenciaPrecision}`
      : `Estás a ${distanciaMetros} m de la instalación (máximo permitido: ${radioPermitido} m).${detallePrecision}${advertenciaPrecision}`,
  };
}

// Un GPS con más error que esto no sirve para ubicar a nadie (típico de un PC
// que estima la posición por IP). El marcaje se acepta pero queda sin verificar.
const PRECISION_MAX_UTIL_M = 1500;

/**
 * Clasifica un marcaje según la distancia a la instalación Y la precisión de la lectura.
 *
 * - verificado:    dentro del radio y con precisión suficiente.
 * - por_revisar:   podría estar dentro, pero la lectura es imprecisa.
 * - sin_ubicacion: no hay lectura utilizable (sin coordenadas o error enorme).
 * - fuera:         está fuera aun descontando el error de la lectura (se rechaza).
 *
 * @returns {{resultado: string, permitido: boolean, distanciaMetros: (number|null),
 *            precisionMetros: (number|null), mensaje: string}}
 */
function clasificarMarcaje(latGuardia, lonGuardia, latInstalacion, lonInstalacion, radioPermitido = 50, precisionM = null) {
  const hayCoordenadas = [latGuardia, lonGuardia].every((v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)));
  const p = precisionM === null || precisionM === undefined || precisionM === '' ? NaN : Number(precisionM);
  const precision = Number.isFinite(p) && p >= 0 ? Math.round(p) : null;

  if (!hayCoordenadas) {
    return {
      resultado: 'sin_ubicacion',
      permitido: true,
      distanciaMetros: null,
      precisionMetros: precision,
      mensaje: 'No se recibió tu ubicación. El marcaje quedó registrado y un supervisor lo revisará.',
    };
  }

  const distanciaMetros = Math.round(
    calcularDistancia(Number(latGuardia), Number(lonGuardia), latInstalacion, lonInstalacion),
  );

  if (precision !== null && precision > PRECISION_MAX_UTIL_M) {
    return {
      resultado: 'sin_ubicacion',
      permitido: true,
      distanciaMetros,
      precisionMetros: precision,
      mensaje: `Este equipo no entrega una ubicación confiable (error de ±${precision} m). `
        + 'El marcaje quedó registrado y un supervisor lo revisará; para verificarlo, marca desde un celular.',
    };
  }

  const margen = precision ?? 0;
  if (distanciaMetros - margen > radioPermitido) {
    return {
      resultado: 'fuera',
      permitido: false,
      distanciaMetros,
      precisionMetros: precision,
      mensaje: `Estás a ${distanciaMetros} m de la instalación (máximo permitido: ${radioPermitido} m)`
        + `${precision !== null ? `, con una precisión de ±${precision} m` : ''}. Acércate al punto de marcaje.`,
    };
  }

  if (distanciaMetros <= radioPermitido && (precision === null || precision <= radioPermitido)) {
    return {
      resultado: 'verificado',
      permitido: true,
      distanciaMetros,
      precisionMetros: precision,
      mensaje: `Marcaje verificado. Estás a ${distanciaMetros} m de la instalación (máximo permitido: ${radioPermitido} m).`,
    };
  }

  return {
    resultado: 'por_revisar',
    permitido: true,
    distanciaMetros,
    precisionMetros: precision,
    mensaje: `Tu ubicación es imprecisa (±${precision} m). El marcaje quedó registrado y un supervisor lo revisará.`,
  };
}

// Exportamos las funciones para usarlas en los controladores
module.exports = {
  calcularDistancia,
  validarAsistencia,
  clasificarMarcaje,
  PRECISION_MAX_UTIL_M,
};
