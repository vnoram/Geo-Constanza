-- MULTIEMPRESA, PASO 2 DE 2 — ENDURECER
--
-- Requiere el paso 1 (20261105120000_multiempresa_aditiva). Primero VERIFICA que no quede
-- ningún registro sin empresa; si queda alguno, aborta con un mensaje y no cambia nada
-- (Postgres ejecuta la migración completa en una sola transacción).
--
-- Reversa: antes de aplicar este paso, respalda la base. El código anterior a multiempresa
-- NO funciona después de este paso (inserta sin empresa_id).

-- 1. VERIFICACIÓN DE NULL (aborta si falla)
DO $$
DECLARE
    pendientes TEXT := '';
    n BIGINT;
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['Instalacion','Supervisor_Instalacion','Turno','Asistencia','Novedad','NovedadHistorial','Solicitud']
    LOOP
        EXECUTE format('SELECT count(*) FROM %I WHERE "empresa_id" IS NULL', t) INTO n;
        IF n > 0 THEN pendientes := pendientes || format(' %s=%s', t, n); END IF;
    END LOOP;

    -- El único usuario sin empresa permitido es el super_admin
    SELECT count(*) INTO n FROM "Usuario" WHERE "empresa_id" IS NULL AND "rol" <> 'super_admin';
    IF n > 0 THEN pendientes := pendientes || format(' Usuario=%s', n); END IF;

    IF pendientes <> '' THEN
        RAISE EXCEPTION 'multiempresa: hay registros sin empresa_id (%). No se aplica NOT NULL; revisa el relleno del paso 1.', trim(pendientes);
    END IF;
END $$;

-- 2. NOT NULL en las tablas operativas.
--    Usuario queda NULLABLE a propósito (el super_admin no tiene empresa) y Auditoria también
--    (las acciones de plataforma no pertenecen a ninguna empresa).
ALTER TABLE "Instalacion"            ALTER COLUMN "empresa_id" SET NOT NULL;
ALTER TABLE "Supervisor_Instalacion" ALTER COLUMN "empresa_id" SET NOT NULL;
ALTER TABLE "Turno"                  ALTER COLUMN "empresa_id" SET NOT NULL;
ALTER TABLE "Asistencia"             ALTER COLUMN "empresa_id" SET NOT NULL;
ALTER TABLE "Novedad"                ALTER COLUMN "empresa_id" SET NOT NULL;
ALTER TABLE "NovedadHistorial"       ALTER COLUMN "empresa_id" SET NOT NULL;
ALTER TABLE "Solicitud"              ALTER COLUMN "empresa_id" SET NOT NULL;

-- 3. Regla del super admin a nivel de base de datos: tiene empresa si y solo si NO es super_admin.
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresa_rol_ck"
    CHECK (("rol" = 'super_admin') = ("empresa_id" IS NULL));

-- 4. Folio de novedades por empresa: sale de la secuencia global y pasa a UNIQUE(empresa_id, numero).
--    El contador Empresa.ultimo_folio se recalcula para no repetir ningún folio ya emitido.
UPDATE "Empresa" e
   SET "ultimo_folio" = GREATEST(e."ultimo_folio", COALESCE((SELECT MAX(n."numero") FROM "Novedad" n WHERE n."empresa_id" = e."id"), 0));

ALTER TABLE "Novedad" ALTER COLUMN "numero" DROP DEFAULT;
DROP SEQUENCE IF EXISTS "Novedad_numero_seq";
DROP INDEX "Novedad_numero_key";
CREATE UNIQUE INDEX "Novedad_empresa_id_numero_key" ON "Novedad"("empresa_id", "numero");

-- 5. Claves foráneas COMPUESTAS (empresa_id, id): reemplazan a las simples. Un registro de una
--    empresa ya no puede apuntar a uno de otra, ni siquiera por un error de código.
ALTER TABLE "Asistencia" DROP CONSTRAINT "Asistencia_instalacion_id_fkey";
ALTER TABLE "Asistencia" DROP CONSTRAINT "Asistencia_turno_id_fkey";
ALTER TABLE "Asistencia" DROP CONSTRAINT "Asistencia_usuario_id_fkey";
ALTER TABLE "Novedad" DROP CONSTRAINT "Novedad_asignada_a_fkey";
ALTER TABLE "Novedad" DROP CONSTRAINT "Novedad_instalacion_id_fkey";
ALTER TABLE "Novedad" DROP CONSTRAINT "Novedad_turno_id_fkey";
ALTER TABLE "Novedad" DROP CONSTRAINT "Novedad_usuario_id_fkey";
ALTER TABLE "NovedadHistorial" DROP CONSTRAINT "NovedadHistorial_novedad_id_fkey";
ALTER TABLE "NovedadHistorial" DROP CONSTRAINT "NovedadHistorial_usuario_id_fkey";
ALTER TABLE "Solicitud" DROP CONSTRAINT "Solicitud_revisada_por_fkey";
ALTER TABLE "Solicitud" DROP CONSTRAINT "Solicitud_usuario_id_fkey";
ALTER TABLE "Solicitud" DROP CONSTRAINT "Solicitud_vacante_turno_id_fkey";
ALTER TABLE "Supervisor_Instalacion" DROP CONSTRAINT "Supervisor_Instalacion_instalacion_id_fkey";
ALTER TABLE "Supervisor_Instalacion" DROP CONSTRAINT "Supervisor_Instalacion_supervisor_id_fkey";
ALTER TABLE "Turno" DROP CONSTRAINT "Turno_instalacion_id_fkey";
ALTER TABLE "Turno" DROP CONSTRAINT "Turno_usuario_id_fkey";
ALTER TABLE "Usuario" DROP CONSTRAINT "Usuario_instalacion_asignada_id_fkey";

ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresa_id_instalacion_asignada_id_fkey" FOREIGN KEY ("empresa_id", "instalacion_asignada_id") REFERENCES "Instalacion"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supervisor_Instalacion" ADD CONSTRAINT "Supervisor_Instalacion_empresa_id_supervisor_id_fkey" FOREIGN KEY ("empresa_id", "supervisor_id") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supervisor_Instalacion" ADD CONSTRAINT "Supervisor_Instalacion_empresa_id_instalacion_id_fkey" FOREIGN KEY ("empresa_id", "instalacion_id") REFERENCES "Instalacion"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_empresa_id_instalacion_id_fkey" FOREIGN KEY ("empresa_id", "instalacion_id") REFERENCES "Instalacion"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_empresa_id_turno_id_fkey" FOREIGN KEY ("empresa_id", "turno_id") REFERENCES "Turno"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_empresa_id_instalacion_id_fkey" FOREIGN KEY ("empresa_id", "instalacion_id") REFERENCES "Instalacion"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_empresa_id_asignada_a_fkey" FOREIGN KEY ("empresa_id", "asignada_a") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_empresa_id_instalacion_id_fkey" FOREIGN KEY ("empresa_id", "instalacion_id") REFERENCES "Instalacion"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_empresa_id_turno_id_fkey" FOREIGN KEY ("empresa_id", "turno_id") REFERENCES "Turno"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NovedadHistorial" ADD CONSTRAINT "NovedadHistorial_empresa_id_novedad_id_fkey" FOREIGN KEY ("empresa_id", "novedad_id") REFERENCES "Novedad"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NovedadHistorial" ADD CONSTRAINT "NovedadHistorial_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_empresa_id_vacante_turno_id_fkey" FOREIGN KEY ("empresa_id", "vacante_turno_id") REFERENCES "Turno"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_empresa_id_revisada_por_fkey" FOREIGN KEY ("empresa_id", "revisada_por") REFERENCES "Usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
