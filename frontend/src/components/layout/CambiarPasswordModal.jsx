import { useState } from "react";
import { T, FONT } from "../../theme/theme";
import { Input } from "../ui/Input";
import { Btn } from "../ui/Btn";
import { Icon } from "../ui/Icon";
import { api } from "../../services/api";

const PASSWORD_MIN = 10;

// "Mi cuenta": el usuario cambia su propia contraseña. Al terminar se cierra la sesión.
export function CambiarPasswordModal({ onClose, onDone }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const guardar = async () => {
    setError("");
    if (!actual) { setError("Ingresa tu contraseña actual"); return; }
    if (nueva.length < PASSWORD_MIN) { setError(`La contraseña nueva debe tener al menos ${PASSWORD_MIN} caracteres`); return; }
    if (nueva !== repetir) { setError("Las contraseñas nuevas no coinciden"); return; }
    setLoading(true);
    try {
      await api.cambiarPassword(actual, nueva);
      onDone();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Cambiar contraseña" style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 400, background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: T.radius, padding: 20, fontFamily: FONT.ui, color: T.text,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px" }}>Cambiar mi contraseña</h2>
        <p style={{ fontSize: 13, color: T.textSec, margin: "0 0 16px" }}>
          Al guardar se cerrarán tus sesiones y deberás entrar de nuevo.
        </p>
        <Input label="Contraseña actual" type="password" icon="key-round" value={actual} onChange={setActual} />
        <Input label="Contraseña nueva" type="password" icon="key-round" value={nueva} onChange={setNueva} />
        <Input label="Repetir contraseña nueva" type="password" icon="key-round" value={repetir} onChange={setRepetir} />
        {error && (
          <div role="alert" style={{
            display: "flex", gap: 10, alignItems: "flex-start", background: T.alertGhost,
            border: `1px solid ${T.alert}`, borderRadius: T.radius, padding: "10px 12px",
            marginBottom: 16, fontSize: 13, color: T.text,
          }}>
            <Icon name="circle-alert" size={17} color={T.alert} style={{ marginTop: 1 }} />
            <div>{error}</div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={guardar} loading={loading} full>Guardar</Btn>
        </div>
      </div>
    </div>
  );
}
