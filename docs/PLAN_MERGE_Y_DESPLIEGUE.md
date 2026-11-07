# Plan de merge y despliegue (Sprint 5 y seguridad)

Estado al 2 de noviembre de 2026. Producción: backend en Azure Container Apps, frontend en Vercel.
Este plan no se ejecuta solo: cada merge y cada despliegue los decide y hace el responsable del proyecto.

## 1. Qué hay que saber antes de empezar

- Los PR #18 al #42 forman **una cadena lineal**: cada rama contiene a la anterior y todos están en estado limpio contra `main`. Se mergean de a uno, del más antiguo al más nuevo.
- Hay 8 migraciones nuevas. Son todas **aditivas** (columnas y tablas nuevas, sin borrar datos). El contenedor las aplica al arrancar con `prisma migrate deploy`.
- Probado en local (Docker): 266 pruebas del backend, 12 pruebas con base real, 42 comprobaciones por HTTP de los cinco perfiles y recorrido de la interfaz.

## 2. Antes del primer merge

- [ ] Respaldo manual de la base de producción (anotar fecha y nombre del respaldo).
- [ ] Confirmar el tope semanal de horas (`MAX_HORAS_SEMANALES`; por defecto 42 h, 40 h desde el 26-04-2028).
- [ ] Decidir si se exigirá 2FA en la defensa o solo en producción real (`REQUIRE_2FA`).
- [ ] Probar a mano en el Docker local los flujos que se quieran mostrar (ver `docs/DOCKER_LOCAL.md`).

## 3. Orden de merge

### Tanda 1: Sprint 5 completo (sin cambios de acceso)

| Orden | PR | Contenido | Migración |
|---|---|---|---|
| 1 | #18, #19 | Comentario al resolver, permisos por instalación | no |
| 2 | #20 | Folio de novedades | sí |
| 3 | #21 | Asignar responsable | sí |
| 4 | #22 | Historial de la novedad | sí |
| 5 | #23, #24, #25 | Auditoría, sockets por rol, pruebas funcionales | no |
| 6 | #26, #27 | Íconos Lucide, lint del backend | no |
| 7 | #28 | Registro de dispositivos y FCM | sí |
| 8 | #29 | Vacantes de cobertura | sí |
| 9 | #30 | Solape y máximo semanal | no |
| 10 | #31 | Tolerancia por instalación | sí |
| 11 | #32, #33, #34 | Pruebas, bitácora en PDF, documentación | no |

Después de esta tanda: desplegar y verificar (sección 4).

### Tanda 2: seguridad y despliegue

| Orden | PR | Contenido | Migración |
|---|---|---|---|
| 12 | #35 | 2FA TOTP para supervisor y administrador | sí |
| 13 | #36 | Restablecer contraseña por correo | sí |
| 14 | #37, #38, #39 | Correcciones de seguridad, renovación de sesión, dependencias | no |
| 15 | #40, #41, #42 | Documentación de Azure, 2FA seguro sin clave, Docker local | no |

Antes de esta tanda, cargar las variables de la sección 5. Después, desplegar y verificar.

PR antiguos sin relación con esta cadena: #1 (sandbox de Railway) y #6 (panel Insight) y #16 (`CLAUDE.md`). Se revisan aparte.

## 4. Verificación después de cada despliegue

1. `GET /api/v1/health` responde `ok` en la URL del backend.
2. En el registro del contenedor: las migraciones terminaron sin error y no hay errores de arranque.
3. Iniciar sesión con un usuario de cada rol y abrir su pantalla principal.
4. Crear una novedad y comprobar que tiene folio; resolverla y revisar el historial.
5. Marcar entrada y salida (idealmente desde un celular).
6. Tanda 2: enrolar el 2FA del administrador y guardar los códigos de recuperación.

## 5. Variables de entorno en Azure Container Apps

Los secretos se crean en *Secretos* y se referencian desde *Variables de entorno*. Nunca van en el repositorio.

| Variable | Para qué | Tanda |
|---|---|---|
| `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` | Notificaciones push | 1 |
| `MAX_HORAS_SEMANALES` | Opcional: solo reduce el máximo ordinario | 1 |
| `TWO_FACTOR_ENCRYPTION_KEY` | Cifrado del secreto 2FA (guardar copia segura; si se pierde hay que reiniciar el 2FA de todos) | 2 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Correo de restablecer contraseña | 2 |
| `REQUIRE_2FA` | Solo si se quiere desactivar el 2FA a propósito (`false`) | 2 |
| `DATABASE_SSL` | Opcional: `disable`, `require` o `verify` | 2 |

En Vercel: `VITE_API_URL` apuntando al backend. `VITE_MOSTRAR_DEMO` solo si se quiere mostrar el panel de credenciales demo.

## 6. Si algo sale mal

- Falla el arranque tras un merge: volver a la revisión anterior del Container App (*Revisiones*, activar la anterior). Las migraciones son aditivas, así que el código anterior sigue funcionando con la base nueva.
- Un usuario queda bloqueado por el 2FA: un administrador lo reinicia (`POST /usuarios/:id/2fa/reset`). Si el bloqueado es el único administrador, desactivar temporalmente con `REQUIRE_2FA=false` y crear la revisión.
- Datos dañados: restaurar el respaldo del paso 2 (último recurso; se pierde lo ocurrido desde entonces).

## 7. Después de mergear

- Cerrar en Azure DevOps las tareas vinculadas a cada PR (ya están en *Active* con el PR enlazado).
- Pasar a *Resolved* las historias cuyas tareas queden todas cerradas.
- Borrar las ramas ya mergeadas.
