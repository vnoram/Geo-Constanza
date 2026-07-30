import { uploadFotoToAzure } from "../utils/azureStorage";

router.post("/crear", authenticate, async (req, res) => {
  try {
    const { tipo_incidente, descripcion, fotoBase64 } = req.body;
    const { user_id } = req.user;

    let fotoUrl = null;
    if (fotoBase64) {
      const fotoBuffer = Buffer.from(fotoBase64, "base64");
      const nombreArchivo = `reportes-${Date.now()}.jpg`;
      fotoUrl = await uploadFotoToAzure(fotoBuffer, nombreArchivo);
    }

    const reporte = await prisma.reportes.create({
      data: {
        ggss_id: user_id,
        tipo_incidente,
        descripcion,
        foto_url: fotoUrl,
        estado: "abierta",
      }
    });

    res.json({
      success: true,
      reporte_id: reporte.id,
      foto_url: fotoUrl
    });

  } catch (error) {
    res.status(500).json({ error: "Error al crear reporte" });
  }
});