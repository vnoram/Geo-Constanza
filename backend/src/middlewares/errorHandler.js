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

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Error interno del servidor' : err.message,
  });
};

module.exports = { errorHandler };
