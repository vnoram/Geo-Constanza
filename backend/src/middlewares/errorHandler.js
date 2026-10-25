const { logger } = require('../config/logger');

const CODIGOS_CONEXION_BD = ['P1001', 'P1002', 'P1008', 'P1017'];

const esErrorDeConexionBD = (err) =>
  CODIGOS_CONEXION_BD.includes(err.code) ||
  err.name === 'PrismaClientInitializationError' ||
  /Can't reach database server|Server has closed the connection|Connection terminated/i.test(err.message || '');

const detalleSoloEnDesarrollo = (err) =>
  process.env.NODE_ENV === 'development' ? { detalle: err.message } : {};

const errorHandler = (err, req, res, _next) => {
  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Error de validación',
      detalles: err.errors.map((e) => ({ campo: e.path.join('.'), mensaje: e.message })),
    });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'El registro ya existe (dato duplicado).' });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro no encontrado.' });
  }

  // Errores de subida de archivos (multer): ej. foto sobre el límite de tamaño
  if (err.name === 'MulterError') {
    const mensajes = {
      LIMIT_FILE_SIZE: 'El archivo supera el tamaño máximo permitido (10 MB).',
      LIMIT_UNEXPECTED_FILE: 'Campo de archivo no esperado.',
    };
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: mensajes[err.code] || `Error al subir el archivo: ${err.message}`,
    });
  }

  // Base de datos inaccesible: no es un fallo del código, es un servicio caído
  if (esErrorDeConexionBD(err)) {
    return res.status(503).json({
      error: 'El servicio no está disponible por el momento. Intenta de nuevo en unos minutos.',
      ...detalleSoloEnDesarrollo(err),
    });
  }

  const statusCode = err.statusCode || 500;
  // Un 5xx nunca devuelve el mensaje interno (rutas, SQL, trozos de código).
  // El motivo real queda en el log; en desarrollo viaja aparte en "detalle".
  if (statusCode >= 500) {
    return res.status(statusCode).json({
      error: 'Error interno del servidor',
      ...detalleSoloEnDesarrollo(err),
    });
  }
  res.status(statusCode).json({ error: err.message });
};

module.exports = { errorHandler };
