# 🗺️ Roadmap — Geo Constanza

> Estado actual: **v1.0.0-beta**  
> Fecha de última actualización: Mayo 2026

---

## Fase 1 — MVP Core Operativo ✅ (en curso)

Objetivo: Sistema funcional con autenticación, gestión de turnos y asistencia básica.

- [x] Autenticación JWT con 5 roles (pauta, libre, supervisor, central, admin)
- [x] RBAC granular por endpoint
- [x] Auditoría inmutable de operaciones
- [x] CRUD de usuarios (admin)
- [x] CRUD de instalaciones (admin)
- [x] Gestión de turnos individuales y en lote
- [x] Algoritmo de pauta 4x4 automático
- [x] Registro de asistencia vía tablet (método primario)
- [x] Fallback de asistencia por móvil
- [x] Geofencing en registro de asistencia
- [x] Reporte de novedades/incidentes con foto
- [x] Escalar y resolver incidentes
- [x] Solicitudes (vacaciones, días libres, traslados, turnos extra)
- [x] Dashboard diario por instalación
- [x] Reportes básicos de asistencia e incidentes
- [x] Frontend por rol (pauta, libre, supervisor, central, admin)
- [x] Deploy en Railway (backend) + Vercel (frontend)

---

## Fase 2 — Real-time con Socket.io 🔄 (próximo)

Objetivo: Comunicación en tiempo real entre guardias, supervisores y central.

- [ ] Notificaciones push de nuevas novedades al supervisor de guardia
- [ ] Mapa en tiempo real con ubicaciones GPS de guardias activos
- [ ] Estado en vivo de asistencia en el dashboard (entradas/salidas al instante)
- [ ] Alertas de escalamiento automático a Central
- [ ] Indicador de conexión/desconexión por guardia
- [ ] Sala Socket.io por instalación para isolación de eventos

---

## Fase 3 — BI Avanzado 📊 (planificado)

Objetivo: Análisis de datos operacionales para toma de decisiones.

- [ ] Dashboard ejecutivo con KPIs nacionales
- [ ] Gráficos de tendencias de puntualidad mensual/anual
- [ ] Análisis de instalaciones con más incidentes
- [ ] Predicción de ausencias (machine learning básico)
- [ ] Exportación de reportes en PDF, Excel y CSV
- [ ] Comparativas entre instalaciones
- [ ] Histórico de cumplimiento de rondas
- [ ] Alertas automáticas cuando KPIs caen bajo umbral

---

## Fase 4 — Aplicación Móvil Nativa 📱 (planificado)

Objetivo: Apps nativas para iOS y Android con capacidades offline.

- [ ] App React Native para GGSS En Pauta (tablet kiosk + fallback)
- [ ] App React Native para GGSS Libre (solicitudes y turnos)
- [ ] App React Native para Supervisor (monitoreo de instalación)
- [ ] Modo offline con sincronización diferida
- [ ] Notificaciones push nativas (Firebase Cloud Messaging)
- [ ] Validación biométrica para marcaje de asistencia
- [ ] Escaneo QR para entrada en tablet kiosk
- [ ] Publicación en App Store y Google Play

---

## Fase 5 — Integraciones y Cumplimiento Legal 🔗 (futuro)

Objetivo: Integración con sistemas de nómina y cumplimiento regulatorio.

- [ ] Integración con sistemas de nómina (exportación de horas trabajadas)
- [ ] Reporte automático a plataforma OS10 (Carabineros de Chile)
- [ ] Cumplimiento total Ley N° 21.659 — reportes regulatorios
- [ ] Integración con sistema de control de acceso físico (RFID/QR)
- [ ] API pública para clientes enterprise
- [ ] SSO (Single Sign-On) con Microsoft/Google para empresas
- [ ] Multi-empresa (SaaS multi-tenant)
- [ ] Respaldos automáticos cifrados a S3

---

## Deuda técnica y mejoras técnicas 🔧 (continuo)

- [ ] Agregar validaciones Zod en todos los endpoints
- [ ] Aumentar cobertura de tests al 80%+
- [ ] Implementar refresh token rotation
- [ ] Agregar Swagger/OpenAPI para documentación interactiva de la API
- [ ] Configurar monitoreo con Sentry o Datadog
- [ ] Implementar health checks de Redis y Firebase al arrancar
- [ ] Migrar `socket.io` CORS de `origin: '*'` a origen específico en producción
- [ ] Agregar índices de BD en columnas de búsqueda frecuente
- [ ] Implementar paginación en todos los listados
- [ ] Agregar caché Redis en consultas de dashboard frecuentes

---

## Versiones

| Versión    | Fecha estimada | Descripción |
|------------|----------------|-------------|
| 1.0.0-beta | Abril 2026     | MVP — Fase 1 |
| 1.1.0      | Julio 2026     | Real-time completo — Fase 2 |
| 1.2.0      | Octubre 2026   | BI Avanzado — Fase 3 |
| 2.0.0      | Marzo 2027     | Apps nativas — Fase 4 |
| 3.0.0      | Diciembre 2027 | Integraciones enterprise — Fase 5 |
