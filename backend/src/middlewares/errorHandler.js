const { logger } = require('../config/logger');

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

  const statusCode = err.statusCode || 500;
  // En desarrollo se devuelve el motivo real del 500 para facilitar la depuración
  const ocultarDetalle = statusCode === 500 && process.env.NODE_ENV === 'production';
  res.status(statusCode).json({
    error: ocultarDetalle ? 'Error interno del servidor' : err.message,
  });
};

module.exports = { errorHandler };
