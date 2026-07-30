import { useState } from "react";
import axios from "axios";

export default function Reportes() {
  const [foto, setFoto] = useState(null);
  const [tipo, setTipo] = useState("ROBO");
  const [descripcion, setDescripcion] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFoto = (e) => {
    setFoto(e.target.files[0]);
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(file);
    });
  };

  const handleEnviar = async () => {
    if (!foto || !descripcion) {
      alert("Falta foto o descripción");
      return;
    }

    setLoading(true);
    const fotoBase64 = await fileToBase64(foto);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/reportes/crear`,
        {
          tipo_incidente: tipo,
          descripcion: descripcion,
          fotoBase64: fotoBase64
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        }
      );

      alert("Reporte creado: " + response.data.reporte_id);
      setFoto(null);
      setDescripcion("");
    } catch (error) {
      alert("Error: " + error.response?.data?.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Crear Reporte</h2>

      <div>
        <label>Tipo:</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option>ROBO</option>
          <option>CONFLICTO</option>
          <option>MANTENIMIENTO</option>
        </select>
      </div>

      <div>
        <label>Descripción:</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </div>

      <div>
        <label>Foto:</label>
        <input type="file" accept="image/*" onChange={handleFoto} />
      </div>

      <button onClick={handleEnviar} disabled={loading}>
        {loading ? "Enviando..." : "Crear Reporte"}
      </button>
    </div>
  );
}