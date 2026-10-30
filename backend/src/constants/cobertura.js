const TOLERANCIA_POR_DEFECTO_MINUTOS = 15;
const toleranciaInstalacion = (instalacion) => instalacion?.tolerancia_atraso_minutos ?? TOLERANCIA_POR_DEFECTO_MINUTOS;
module.exports = { TOLERANCIA_POR_DEFECTO_MINUTOS, toleranciaInstalacion };
