/**
 * @swagger
 * tags:
 *   name: Usuarios
 *   description: Gestión del personal operativo y administrativo del sistema
 */

/**
 * @swagger
 * /api/v1/usuarios/me:
 *   get:
 *     summary: Obtener perfil del usuario autenticado
 *     description: >
 *       Retorna los datos del usuario que realiza la petición.
 *       Disponible para cualquier rol autenticado (guardia, supervisor, admin).
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del perfil propio.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Usuario'
 *       401:
 *         description: Token ausente o inválido.
 */

/**
 * @swagger
 * /api/v1/usuarios:
 *   get:
 *     summary: Listar usuarios del sistema
 *     description: >
 *       Retorna el listado de usuarios registrados. El rol `supervisor` accede
 *       únicamente al personal de su instalación. Los roles `central` y `admin`
 *       visualizan la dotación completa.
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rol
 *         schema:
 *           type: string
 *           enum: [pauta, libre, supervisor, central, admin]
 *         description: Filtrar por rol operativo
 *       - in: query
 *         name: instalacionId
 *         schema:
 *           type: integer
 *         description: Filtrar por instalación asignada
 *       - in: query
 *         name: activo
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado de la cuenta (true = activos, false = desactivados)
 *     responses:
 *       200:
 *         description: Listado de usuarios según los filtros aplicados.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Usuario'
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Rol sin permiso para listar usuarios.
 *   post:
 *     summary: Crear nuevo usuario
 *     description: >
 *       Registra un nuevo miembro del personal en el sistema (guardia, supervisor u otro rol).
 *       Exclusivo para el rol `admin`.
 *     tags: [Usuarios]
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
 *               - email
 *               - password
 *               - rol
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Carlos Fuentes Rojas"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "cfuentes@geoconstanza.cl"
 *               password:
 *                 type: string
 *                 format: password
 *               rol:
 *                 type: string
 *                 enum: [pauta, libre, supervisor, central, admin]
 *               instalacionId:
 *                 type: integer
 *                 description: Instalación principal asignada al usuario
 *                 example: 3
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Usuario'
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Solo el rol `admin` puede crear usuarios.
 *       409:
 *         description: El correo electrónico ya está registrado en el sistema.
 */

/**
 * @swagger
 * /api/v1/usuarios/{id}:
 *   put:
 *     summary: Editar datos de un usuario
 *     description: >
 *       Actualiza la información de un usuario existente (nombre, email, instalación asignada, rol).
 *       Exclusivo para el rol `admin`.
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario a editar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               rol:
 *                 type: string
 *                 enum: [pauta, libre, supervisor, central, admin]
 *               instalacionId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Usuario actualizado correctamente.
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Solo el rol `admin` puede editar usuarios.
 *       404:
 *         description: Usuario no encontrado.
 */

/**
 * @swagger
 * /api/v1/usuarios/{id}/desactivar:
 *   patch:
 *     summary: Desactivar cuenta de usuario
 *     description: >
 *       Realiza una baja lógica del usuario en el sistema. El registro se conserva
 *       para mantener la trazabilidad histórica de turnos, asistencia y novedades.
 *       La cuenta no puede volver a iniciar sesión tras la desactivación.
 *       Exclusivo para el rol `admin`.
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario a desactivar
 *     responses:
 *       200:
 *         description: Cuenta desactivada. El usuario ya no puede autenticarse.
 *       401:
 *         description: Token ausente o inválido.
 *       403:
 *         description: Solo el rol `admin` puede desactivar usuarios.
 *       404:
 *         description: Usuario no encontrado.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Usuario:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nombre:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         rol:
 *           type: string
 *           enum: [pauta, libre, supervisor, central, admin]
 *         activo:
 *           type: boolean
 *         instalacionId:
 *           type: integer
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 */

const { Router } = require('express');
const usuariosController = require('../controllers/usuarios.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

// ── Perfil propio (cualquier rol autenticado) ──────────────────────────────
router.get('/me', usuariosController.miInformacion);

// ── CRUD (solo admin, supervisor puede listar) ─────────────────────────────
router.get('/', authorize('supervisor', 'central', 'admin'), usuariosController.listar);
router.post('/', authorize('admin'), usuariosController.crear);
router.put('/:id', authorize('admin'), usuariosController.editar);
router.patch('/:id/desactivar', authorize('admin'), usuariosController.desactivar);

module.exports = router;
