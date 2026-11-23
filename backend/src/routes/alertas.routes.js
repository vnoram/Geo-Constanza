/**
 * @swagger
 * /api/v1/alertas/mias:
 *   get:
 *     summary: Alertas recientes del guardia autenticado
 *     description: >
 *       Próximo turno y novedades, solicitudes y marcajes del propio guardia que cambiaron de estado
 *       en los últimos 7 días. Solo rol GGSS; siempre acotado a su empresa y a su usuario.
 *     tags: [Alertas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de alertas (`id`, `tipo`, `nivel`, `titulo`, `detalle`, `fecha`).
 */
const { Router } = require('express');
const { mias } = require('../controllers/alertasGuardia.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize, exigirEmpresa } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');

const router = Router();
router.use(authenticate, exigirEmpresa);
router.get('/mias', authorize(ROLES.GGSS), mias);

module.exports = router;
