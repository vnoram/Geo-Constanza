const usuariosService = require('../services/usuarios.service');
const { registrarAuditoria } = require('../middlewares/auditLog');

/**
 * GET /usuarios/me — perfil del usuario autenticado (cualquier rol)
 */
const miInformacion = async (req, res, next) => {
  try {
    const usuario = await usuariosService.miInformacion(req.user.id);
    res.json(usuario);
  } catch (error) {
    next(error);
  }
};

const listar = async (req, res, next) => {
  try {
    const { rol, estado, page = 1, limit = 20 } = req.query;
    const result = await usuariosService.listar({ rol, estado, page: +page, limit: +limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const usuario = await usuariosService.crear(req.body);

    await registrarAuditoria({
      usuarioId: req.user.id,
      accion: 'crear',
      tablaAfectada: 'usuarios',
      registroId: usuario.id,
      valoresDespues: req.body,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json(usuario);
  } catch (error) {
    next(error);
  }
};

const editar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuario = await usuariosService.editar(id, req.body);

    await registrarAuditoria({
      usuarioId: req.user.id,
      accion: 'editar',
      tablaAfectada: 'usuarios',
      registroId: id,
      valoresDespues: req.body,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json(usuario);
  } catch (error) {
    next(error);
  }
};

const desactivar = async (req, res, next) => {
  try {
    const { id } = req.params;
    await usuariosService.desactivar(id);

    await registrarAuditoria({
      usuarioId: req.user.id,
      accion: 'desactivar',
      tablaAfectada: 'usuarios',
      registroId: id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ message: 'Usuario desactivado correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = { miInformacion, listar, crear, editar, desactivar };
