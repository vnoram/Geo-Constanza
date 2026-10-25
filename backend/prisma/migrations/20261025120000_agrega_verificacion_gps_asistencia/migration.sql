-- AlterTable: resultado de validar el GPS en la entrada de la asistencia
ALTER TABLE "Asistencia" ADD COLUMN "verificacion_gps" TEXT;
ALTER TABLE "Asistencia" ADD COLUMN "distancia_entrada_m" INTEGER;
ALTER TABLE "Asistencia" ADD COLUMN "precision_entrada_m" INTEGER;
