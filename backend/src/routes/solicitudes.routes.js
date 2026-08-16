/**
 * @swagger
 * tags:
 *   name: Solicitudes
 *   description: Flujo de permisos, cambios de turno y licencias del personal operativo
 */

/**
 * @swagger
 * /api/v1/solicitudes:
 *   get:
 *     summary: Listar solicitudes
 *     description: >
 *       Un guardia (`pauta` o `libre`) visualiza únicamente sus propias solicitudes.
 *       Supervisores y admin visualizan las solicitudes del personal bajo su gestión,
 *       incluyendo las pendientes de resolución.
 *     tags: [Solicitudes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [pendiente, aprobada, rechazada]
 *         description: Filtrar por estado de la solicitud
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [permiso, cambio_turno, licencia_medica, vacaciones]
 *         description: Filtrar por tipo de solicitud
 *     responses:
 *       200:
 *         description: Listado de solicitudes según el rol y filtros aplicados.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Solicitud'
 *       401:
 *         description: Token ausente o inválido.
 *   post:
 *     summary: Crear solicitud de permiso o licencia
 *     description: >
 *       Permite a un guardia (`pauta` o `libre`) elevar una solicitud formal
 *       de permiso, cambio de turno o licencia. La solicitud queda en estado
 *       `pendiente` hasta que el supervisor o admin la resuelva.
 *     tags: [Solicitudes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tipo
 *               - fechaInicio
 *               - fechaFin
 *               - motivo
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [permiso, cambio_turno, licencia_medica, vacaciones]
 *                 example: "permiso"
 *               fechaInicio:
 *                 type: string
 *                 format: date
 *                 description: Primer día que abarca la solicitud
 *                 example: "2025-06-15"
 *               fechaFin:
 *                 type: string
 *                 format: date
 *                 description: Último día que abarca la solicitud
 *                 example: "2025-06-15"
 *               motivo:
 *                 type: string
 *                 description: Descripción del motivo de la solicitud
 *                 example: "Trámite médico urgente de familiar directo"
 *     responses:
 *       201:
 *         description: Solicitud creada y enviada al supervisor para revisión.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Solicitud'
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Solo guardias (`pauta` y `libre`) pueden crear solicitudes.
 */

/**
 * @swagger
 * /api/v1/solicitudes/{id}/aprobar:
 *   patch:
 *     summary: Aprobar solicitud
 *     description: >
 *       El supervisor aprueba una solicitud pendiente del personal de su instalación.
 *       El rol `admin` puede aprobar solicitudes de cualquier instalación.
 *       La aprobación queda registrada con el ID del resolutor y timestamp.
 *     tags: [Solicitudes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la solicitud a aprobar
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               observacion:
 *                 type: string
 *                 description: Comentario opcional del supervisor al aprobar
 *                 example: "Aprobado. Coordinar con guardia de reemplazo."
 *     responses:
 *       200:
 *         description: Solicitud aprobada. Estado actualizado a `aprobada`.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Solicitud'
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Solo `supervisor` y `admin` pueden aprobar solicitudes.
 *       404:
 *         description: Solicitud no encontrada.
 *       409:
 *         description: La solicitud ya fue resuelta previamente.
 */

/**
 * @swagger
 * /api/v1/solicitudes/{id}/rechazar:
 *   patch:
 *     summary: Rechazar solicitud
 *     description: >
 *       El supervisor rechaza una solicitud pendiente indicando el motivo obligatorio.
 *       El guardia puede consultar el rechazo y su justificación en el listado propio.
 *       El rol `admin` puede rechazar solicitudes de cualquier instalación.
 *     tags: [Solicitudes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la solicitud a rechazar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - motivo
 *             properties:
 *               motivo:
 *                 type: string
 *                 description: Justificación obligatoria del rechazo
 *                 example: "Dotación mínima requerida no puede ser cubierta en esa fecha."
 *     responses:
 *       200:
 *         description: Solicitud rechazada. Estado actualizado a `rechazada`.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Solicitud'
 *       400:
 *         description: El campo `motivo` es requerido para rechazar una solicitud.
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Solo `supervisor` y `admin` pueden rechazar solicitudes.
 *       404:
 *         description: Solicitud no encontrada.
 *       409:
 *         description: La solicitud ya fue resuelta previamente.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Solicitud:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         tipo:
 *           type: string
 *           enum: [permiso, cambio_turno, licencia_medica, vacaciones]
 *         estado:
 *           type: string
 *           enum: [pendiente, aprobada, rechazada]
 *         fechaInicio:
 *           type: string
 *           format: date
 *         fechaFin:
 *           type: string
 *           format: date
 *         motivo:
 *           type: string
 *         observacion:
 *           type: string
 *           nullable: true
 *           description: Comentario del supervisor al resolver
 *         solicitanteId:
 *           type: integer
 *         resolvidoPorId:
 *           type: integer
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         resolvedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 */

const { Router } = require('express');
const solicitudesController = require('../controllers/solicitudes.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');

const router = Router();

router.use(authenticate);

// ── GGSS: ver y crear sus propias solicitudes ─────────────────────────────
router.get('/',  authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE, ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), solicitudesController.listar);
router.post('/', authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE), solicitudesController.crear);

// ── Supervisor/Admin: aprobar y rechazar ──────────────────────────────────
router.patch('/:id/aprobar',  authorize(ROLES.SUPERVISOR, ROLES.ADMINISTRADOR), solicitudesController.aprobar);
router.patch('/:id/rechazar', authorize(ROLES.SUPERVISOR, ROLES.ADMINISTRADOR), solicitudesController.rechazar);

module.exports = router;
