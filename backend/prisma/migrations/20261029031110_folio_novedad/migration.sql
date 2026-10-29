/*
  Warnings:

  - A unique constraint covering the columns `[numero]` on the table `Novedad` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Novedad" ADD COLUMN     "numero" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Novedad_numero_key" ON "Novedad"("numero");
