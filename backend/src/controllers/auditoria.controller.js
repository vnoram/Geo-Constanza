const { prisma } = require('../config/database');

const listar = async (req, res, next) => {
  try {
    const { usuario_id, accion, fecha_inicio, fecha_fin, page = 1, limit = 50 } = req.query;

    const where = {};
    if (usuario_id) where.usuario_id = usuario_id;
    if (accion) where.accion = accion;
    if (fecha_inicio || fecha_fin) {
      where.created_at = {};
      if (fecha_inicio) where.created_at.gte = new Date(fecha_inicio);
      if (fecha_fin) where.created_at.lte = new Date(fecha_fin);
    }

    const [registros, total] = await Promise.all([
      prisma.auditoria.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (+page - 1) * +limit,
        take: +limit,
        include: { usuario: { select: { nombre: true, email: true, rol: true } } },
      }),
      prisma.auditoria.count({ where }),
    ]);

    res.json({ data: registros, total, page: +page, totalPages: Math.ceil(total / +limit) });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar };
