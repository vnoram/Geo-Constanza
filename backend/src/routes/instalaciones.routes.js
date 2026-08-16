/**
 * @swagger
 * tags:
 *   name: Instalaciones
 *   description: Catálogo de ubicaciones físicas donde opera el personal de seguridad
 */

/**
 * @swagger
 * /api/v1/instalaciones:
 *   get:
 *     summary: Listar instalaciones
 *     description: >
 *       Retorna el catálogo completo de instalaciones registradas en el sistema.
 *       Cada instalación representa un cliente o punto de vigilancia activo.
 *       Accesible para `supervisor`, `central` y `admin`.
 *     tags: [Instalaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activa
 *         schema:
 *           type: boolean
 *         description: Filtrar por instalaciones activas o inactivas
 *       - in: query
 *         name: nombre
 *         schema:
 *           type: string
 *         description: Búsqueda parcial por nombre de la instalación
 *     responses:
 *       200:
 *         description: Listado de instalaciones.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Instalacion'
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Rol sin permiso para consultar instalaciones.
 *   post:
 *     summary: Registrar nueva instalación
 *     description: >
 *       Crea una nueva instalación (cliente o punto de vigilancia) en el sistema.
 *       La instalación queda disponible para ser asignada a turnos y personal.
 *       Exclusivo para el rol `admin`.
 *     tags: [Instalaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - direccion
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Centro Comercial Mall Plaza Norte"
 *               direccion:
 *                 type: string
 *                 example: "Av. Independencia 3456, Independencia, Santiago"
 *               latitud:
 *                 type: number
 *                 format: float
 *                 description: Coordenada de referencia para validación de marcaje
 *                 example: -33.4073
 *               longitud:
 *                 type: number
 *                 format: float
 *                 example: -70.6724
 *               radioMetros:
 *                 type: integer
 *                 description: Radio en metros para validación de geofence
 *                 example: 150
 *               contactoNombre:
 *                 type: string
 *                 description: Nombre del encargado en el cliente
 *                 example: "Roberto Ahumada"
 *               contactoTelefono:
 *                 type: string
 *                 example: "+56912345678"
 *     responses:
 *       201:
 *         description: Instalación creada y disponible en el sistema.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Instalacion'
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Solo el rol `admin` puede crear instalaciones.
 */

/**
 * @swagger
 * /api/v1/instalaciones/{id}:
 *   put:
 *     summary: Editar datos de una instalación
 *     description: >
 *       Actualiza la información operativa de una instalación existente
 *       (nombre, dirección, coordenadas de referencia, radio de geofence, datos de contacto).
 *       Exclusivo para el rol `admin`.
 *     tags: [Instalaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la instalación a editar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               direccion:
 *                 type: string
 *               latitud:
 *                 type: number
 *                 format: float
 *               longitud:
 *                 type: number
 *                 format: float
 *               radioMetros:
 *                 type: integer
 *               contactoNombre:
 *                 type: string
 *               contactoTelefono:
 *                 type: string
 *     responses:
 *       200:
 *         description: Instalación actualizada correctamente.
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Solo el rol `admin` puede editar instalaciones.
 *       404:
 *         description: Instalación no encontrada.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Instalacion:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nombre:
 *           type: string
 *         direccion:
 *           type: string
 *         latitud:
 *           type: number
 *           nullable: true
 *         longitud:
 *           type: number
 *           nullable: true
 *         radioMetros:
 *           type: integer
 *           nullable: true
 *         contactoNombre:
 *           type: string
 *           nullable: true
 *         contactoTelefono:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 */

const { Router } = require('express');
const instalacionesController = require('../controllers/instalaciones.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');

const router = Router();

router.use(authenticate);

router.get('/', authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), instalacionesController.listar);
router.post('/', authorize(ROLES.ADMINISTRADOR), instalacionesController.crear);
router.put('/:id', authorize(ROLES.ADMINISTRADOR), instalacionesController.editar);

module.exports = router;
