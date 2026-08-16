// dotenv se carga en server.js antes de este módulo — no duplicar aquí
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const { errorHandler } = require('./middlewares/errorHandler');
const { rateLimiter } = require('./middlewares/rateLimiter');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const instalacionesRoutes = require('./routes/instalaciones.routes');
const turnosRoutes = require('./routes/turnos.routes');
const asistenciaRoutes = require('./routes/asistencia.routes');
const novedadesRoutes = require('./routes/novedades.routes');
const solicitudesRoutes = require('./routes/solicitudes.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const reportesRoutes = require('./routes/reportes.routes');
const auditoriaRoutes = require('./routes/auditoria.routes');

const app = express();
// Railway coloca la app detrás de un proxy inverso que agrega el header
// X-Forwarded-For. Sin esto, Express no confía en ese header y
// express-rate-limit lanza ERR_ERL_UNEXPECTED_X_FORWARDED_FOR en cada
// request, sin poder identificar la IP real de cada usuario para el rate limit.
app.set('trust proxy', 1);

// CORS debe ir ANTES de helmet para que los headers no sean sobreescritos
const frontendOrigin = process.env.NODE_ENV === 'production'
  ? (process.env.FRONTEND_URL || 'https://geo-constanza.vercel.app').replace(/\/$/, '')
  : true;

const corsOptions = {
  origin: frontendOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // responde preflight en todas las rutas

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(rateLimiter);

// =========================================================================
// CONFIGURACIÓN DE SWAGGER DOCUMENTATION
// =========================================================================
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Geo-Constanza',
      version: '1.0.0',
      description: 'Documentación interactiva de la API para la gestión y monitoreo de guardias de seguridad.',
      contact: {
        name: 'Víctor Norambuena Orellana',
      },
    },
    servers: [
      {
        url: 'http://localhost:3005',
        description: 'Servidor de Desarrollo Local',
      },
      {
        url: 'https://geo-constanza-production.up.railway.app',
        description: 'Servidor de Producción (Railway)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Introduce tu token JWT para consumir rutas protegidas.',
        },
      },
    },
  },
  // Escanea la carpeta routes para buscar las anotaciones JSDoc
  apis: ['./src/routes/*.js', './routes/*.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
// El panel visual se desplegará en la raíz /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
// =========================================================================

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rutas API v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/usuarios', usuariosRoutes);
app.use('/api/v1/instalaciones', instalacionesRoutes);
app.use('/api/v1/turnos', turnosRoutes);
app.use('/api/v1/asistencia', asistenciaRoutes);
app.use('/api/v1/novedades', novedadesRoutes);
app.use('/api/v1/solicitudes', solicitudesRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/reportes', reportesRoutes);
app.use('/api/v1/auditoria', auditoriaRoutes);

// Manejo de errores
app.use(errorHandler);

module.exports = app;