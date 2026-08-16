# Historias de Usuario

> Placeholder generado a partir de las pantallas y endpoints existentes en el
> código (agosto 2026). El Informe de Formulación tiene una Tabla 1 con la
> redacción oficial de HU-01 a HU-06 — reemplazar el contenido de abajo por
> esa tabla literal cuando se tenga el documento a mano. Esta tabla solo sirve
> para no dejar el archivo vacío y como mapa código ↔ funcionalidad.

| ID | Rol | Historia | Pantalla / endpoint |
|---|---|---|---|
| HU-01 | GGSS en Pauta | Como guardia en pauta, quiero marcar entrada/salida por tablet dentro de mi geocerca, para registrar mi asistencia sin intervención manual. | `screens/ggss-en-pauta/PautaTurno.jsx` → `POST /asistencia/entrada-tablet` |
| HU-02 | GGSS en Pauta / Libre | Como guardia, quiero reportar una novedad con foto y ubicación durante mi turno, para que supervisión sea notificada en tiempo real. | `screens/ggss-en-pauta/PautaNovedades.jsx` → `POST /novedades` |
| HU-03 | GGSS Libre | Como guardia libre, quiero ver los turnos disponibles y postular a ellos, para trabajar de forma eventual. | `screens/ggss-libre/LibreTurnos.jsx` → `GET /turnos/disponibles` |
| HU-04 | Supervisor | Como supervisor, quiero ver y resolver/escalar las novedades de mis instalaciones asignadas, para actuar sobre incidentes en curso. | `screens/supervisor/SupNovedades.jsx` → `PATCH /novedades/:id/resolver`, `/escalar` |
| HU-05 | Operador Central | Como operador central, quiero generar la pauta 4x4 en lote y ver un dashboard en tiempo real, para planificar turnos y monitorear la operación global. | `screens/operador-central/CentralPanel.jsx` → `POST /turnos/pauta-4x4`, `GET /dashboard/hoy` |
| HU-06 | Administrador | Como administrador, quiero gestionar usuarios e instalaciones y consultar la auditoría, para mantener el sistema y trazar cambios. | `screens/administrador/AdminUsuarios.jsx`, `AdminInstalaciones.jsx` → `GET /auditoria` |
