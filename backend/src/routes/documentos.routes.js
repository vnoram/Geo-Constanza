const { Router } = require('express');
const multer = require('multer');
const documentos = require('../services/documentos.service');
const { authenticate } = require('../middlewares/auth');
const { authorize, exigirEmpresa } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');
const { conEmpresa } = require('../config/tenant');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const subirArchivo = (req, res, next) => upload.single('archivo')(req, res, (err) => {
  if (!err) return next();
  err.statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
  if (err.code === 'LIMIT_FILE_SIZE') err.message = 'El archivo supera el máximo de 5 MB';
  next(err);
});
// multer continúa fuera del contexto de empresa de `authenticate`: se vuelve a abrir con la del token.
const restaurarEmpresa = (req, res, next) => (
  req.user?.empresaId ? conEmpresa(req.user.empresaId, () => next()) : next()
);

const router = Router();
router.use(authenticate, exigirEmpresa);
const permitidos = authorize(ROLES.GGSS, ROLES.ADMINISTRADOR);

router.get('/', permitidos, async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(await documentos.listar(req.user, req.query)); } catch (err) { next(err); }
});
router.post('/', permitidos, subirArchivo, restaurarEmpresa, async (req, res, next) => {
  try {
    res.status(201).json(await documentos.subir(req.user, req.body, req.file, { ip: req.ip, userAgent: req.get('user-agent') }));
  } catch (err) { next(err); }
});

module.exports = router;
