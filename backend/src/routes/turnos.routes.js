/**
 * @swagger
 * tags:
 *   name: Turnos
 *   description: Planificación y programación de la dotación de seguridad
 */

/**
 * @swagger
 * /api/v1/turnos:
 *   get:
 *     summary: Listar turnos
 *     description: >
 *       Retorna los turnos según el rol del solicitante. Un guardia ve únicamente
 *       sus propios turnos. Supervisores, `central` y `admin` visualizan los turnos
 *       de las instalaciones bajo su gestión.
 *     tags: [Turnos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instalacionId
 *         schema:
 *           type: integer
 *         description: Filtrar por instalación
 *       - in: query
 *         name: fecha
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtrar por fecha específica (YYYY-MM-DD)
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [programado, activo, completado, cancelado]
 *         description: Filtrar por estado del turno
 *     responses:
 *       200:
 *         description: Listado de turnos según filtros y permisos del rol.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Turno'
 *       401:
 *         description: Token ausente o inválido.
 *   post:
 *     summary: Crear turno individual
 *     description: >
 *       Registra un turno para un guardia específico en una instalación y fecha determinada.
 *       Disponible para `supervisor`, `central` y `admin`. El sistema verifica
 *       automáticamente conflictos de horario antes de persistir.
 *     tags: [Turnos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - usuarioId
 *               - instalacionId
 *               - fechaInicio
 *               - fechaFin
 *             properties:
 *               usuarioId:
 *                 type: integer
 *                 description: ID del guardia asignado al turno
 *                 example: 12
 *               instalacionId:
 *                 type: integer
 *                 example: 3
 *               fechaInicio:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-06-01T08:00:00.000Z"
 *               fechaFin:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-06-01T20:00:00.000Z"
 *               notas:
 *                 type: string
 *                 example: "Turno de refuerzo por evento"
 *     responses:
 *       201:
 *         description: Turno creado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Turno'
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Rol sin permiso para crear turnos.
 *       409:
 *         description: Conflicto de horario detectado para el guardia en el rango indicado.
 */

/**
 * @swagger
 * /api/v1/turnos/lote:
 *   post:
 *     summary: Crear turnos en lote
 *     description: >
 *       Permite programar múltiples turnos en una sola operación.
 *       Útil para planificación semanal o mensual de la dotación.
 *       Disponible para `central` y `admin`.
 *     tags: [Turnos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - turnos
 *             properties:
 *               turnos:
 *                 type: array
 *                 description: Lista de turnos a crear
 *                 items:
 *                   type: object
 *                   required:
 *                     - usuarioId
 *                     - instalacionId
 *                     - fechaInicio
 *                     - fechaFin
 *                   properties:
 *                     usuarioId:
 *                       type: integer
 *                     instalacionId:
 *                       type: integer
 *                     fechaInicio:
 *                       type: string
 *                       format: date-time
 *                     fechaFin:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       201:
 *         description: Lote procesado. Retorna resumen de turnos creados y conflictos encontrados.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 creados:
 *                   type: integer
 *                 conflictos:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Solo `central` y `admin` pueden crear turnos en lote.
 */

/**
 * @swagger
 * /api/v1/turnos/pauta-4x4:
 *   post:
 *     summary: Generar pauta automática 4x4
 *     description: >
 *       Genera automáticamente la planificación de turnos bajo el sistema de rotación
 *       4 días trabajados × 4 días libres, estándar en la industria de la seguridad
 *       privada chilena. El sistema proyecta los turnos a partir de la fecha de inicio
 *       indicada por el número de semanas solicitado.
 *       Disponible para `central` y `admin`.
 *     tags: [Turnos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - usuarioId
 *               - instalacionId
 *               - fechaInicio
 *               - semanas
 *             properties:
 *               usuarioId:
 *                 type: integer
 *                 description: Guardia al que se le genera la pauta
 *                 example: 7
 *               instalacionId:
 *                 type: integer
 *                 example: 2
 *               fechaInicio:
 *                 type: string
 *                 format: date
 *                 description: Fecha desde la cual se proyecta la pauta (YYYY-MM-DD)
 *                 example: "2025-06-01"
 *               semanas:
 *                 type: integer
 *                 description: Cantidad de semanas a proyectar (máx. recomendado 8)
 *                 example: 4
 *               horaEntrada:
 *                 type: string
 *                 description: Hora de inicio del turno diario (HH:MM)
 *                 example: "08:00"
 *               horaSalida:
 *                 type: string
 *                 description: Hora de término del turno diario (HH:MM)
 *                 example: "20:00"
 *     responses:
 *       201:
 *         description: Pauta 4x4 generada. Retorna el listado de turnos creados.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 turnosCreados:
 *                   type: integer
 *                 turnos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Turno'
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Solo `central` y `admin` pueden generar pautas automáticas.
 */

/**
 * @swagger
 * /api/v1/turnos/disponibles:
 *   get:
 *     summary: Listar turnos disponibles para GGSS libre
 *     description: >
 *       Retorna los turnos sin guardia asignado en la instalación del solicitante.
 *       Exclusivo para el rol `libre` (guardia de reemplazo o cobertura).
 *     tags: [Turnos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Turnos disponibles que el guardia puede solicitar cubrir.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Turno'
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Exclusivo para el rol `libre`.
 */

/**
 * @swagger
 * /api/v1/turnos/conflictos:
 *   get:
 *     summary: Verificar conflictos de horario en la dotación
 *     description: >
 *       Detecta guardias con turnos solapados o dotación insuficiente para la
 *       instalación en el período consultado. Disponible para `supervisor`, `central` y `admin`.
 *     tags: [Turnos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instalacionId
 *         schema:
 *           type: integer
 *         description: Instalación a verificar
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *           format: date
 *         description: Inicio del período a verificar (YYYY-MM-DD)
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fin del período a verificar (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Resultado del análisis de conflictos.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sinConflictos:
 *                   type: boolean
 *                 conflictos:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Rol sin permiso para verificar conflictos.
 */

/**
 * @swagger
 * /api/v1/turnos/{id}:
 *   get:
 *     summary: Obtener detalle de un turno
 *     tags: [Turnos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del turno
 *     responses:
 *       200:
 *         description: Detalle del turno.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Turno'
 *       401:
 *         description: Token ausente o inválido.
 *       404:
 *         description: Turno no encontrado.
 *   put:
 *     summary: Editar turno existente
 *     description: >
 *       Modifica la fecha, hora o instalación de un turno programado. Solo aplica
 *       a turnos en estado `programado`. Disponible para `supervisor`, `central` y `admin`.
 *     tags: [Turnos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fechaInicio:
 *                 type: string
 *                 format: date-time
 *               fechaFin:
 *                 type: string
 *                 format: date-time
 *               instalacionId:
 *                 type: integer
 *               notas:
 *                 type: string
 *     responses:
 *       200:
 *         description: Turno actualizado.
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Rol sin permiso para editar turnos.
 *       404:
 *         description: Turno no encontrado.
 *       409:
 *         description: El nuevo horario genera un conflicto con otro turno del guardia.
 */

/**
 * @swagger
 * /api/v1/turnos/{id}/cancelar:
 *   patch:
 *     summary: Cancelar un turno programado
 *     description: >
 *       Marca un turno como cancelado, liberando al guardia asignado para ese período.
 *       El registro se conserva en el historial con estado `cancelado`.
 *       Disponible para `supervisor`, `central` y `admin`.
 *     tags: [Turnos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del turno a cancelar
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 *                 example: "Cliente suspendió operaciones el día indicado"
 *     responses:
 *       200:
 *         description: Turno cancelado. Estado actualizado a `cancelado`.
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Rol sin permiso para cancelar turnos.
 *       404:
 *         description: Turno no encontrado.
 *       409:
 *         description: No se puede cancelar un turno que ya está activo o completado.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Turno:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         usuarioId:
 *           type: integer
 *         instalacionId:
 *           type: integer
 *         fechaInicio:
 *           type: string
 *           format: date-time
 *         fechaFin:
 *           type: string
 *           format: date-time
 *         estado:
 *           type: string
 *           enum: [programado, activo, completado, cancelado]
 *         notas:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 */

const { Router } = require('express');
const turnosController = require('../controllers/turnos.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

// ── GGSS Libre: ver turnos disponibles en su instalación asignada ──────────
router.get('/disponibles', authorize('libre'), turnosController.listarDisponibles);

// ── Verificar conflictos (antes de /:id para evitar captura) ───────────────
router.get('/conflictos', authorize('supervisor', 'central', 'admin'), turnosController.verificarConflictos);

// ── Creación de pautas y lotes (antes de /:id) ────────────────────────────
router.post('/lote',      authorize('central', 'admin'), turnosController.crearLote);
router.post('/pauta-4x4', authorize('central', 'admin'), turnosController.crearPauta4x4);

// ── CRUD general ──────────────────────────────────────────────────────────
router.get('/',    authorize('pauta', 'libre', 'supervisor', 'central', 'admin'), turnosController.listar);
router.get('/:id', authorize('pauta', 'libre', 'supervisor', 'central', 'admin'), turnosController.obtener);
router.post('/',   authorize('supervisor', 'central', 'admin'), turnosController.crear);
router.put('/:id', authorize('supervisor', 'central', 'admin'), turnosController.editar);
router.patch('/:id/cancelar', authorize('supervisor', 'central', 'admin'), turnosController.cancelar);

module.exports = router;
