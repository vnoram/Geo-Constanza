// dotenv se carga en server.js antes de este módulo — no duplicar aquí
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

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

// CORS debe ir ANTES de helmet para que los headers no sean sobreescritos
const corsOptions = {
  origin: true, // refleja el origen del request — permite cualquier origen con credentials
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
