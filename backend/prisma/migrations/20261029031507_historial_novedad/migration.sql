-- CreateTable
CREATE TABLE "NovedadHistorial" (
    "id" TEXT NOT NULL,
    "novedad_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "estado_anterior" TEXT,
    "estado_nuevo" TEXT NOT NULL,
    "comentario" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovedadHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NovedadHistorial_novedad_id_created_at_idx" ON "NovedadHistorial"("novedad_id", "created_at");

-- AddForeignKey
ALTER TABLE "NovedadHistorial" ADD CONSTRAINT "NovedadHistorial_novedad_id_fkey" FOREIGN KEY ("novedad_id") REFERENCES "Novedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadHistorial" ADD CONSTRAINT "NovedadHistorial_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
