import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { SubHeader } from "../../components/ui/SubHeader";
import { SectionHeader } from "../../components/ui/SectionHeader";

export function AdminTurnos() {
  return (
    <div>
      <SectionHeader title="Turnos" sub="Gestión masiva de horarios" action={{ label: "+ Crear Lote", onClick: () => {} }} />
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📥</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Importar Turnos</div>
        <div style={{ fontSize: 12, color: T.textMut, marginBottom: 14 }}>
          Sube un archivo CSV o Excel con los turnos programados
        </div>
        <Btn>Seleccionar Archivo</Btn>
      </div>
      <SubHeader title="Turnos Hoy (45)" />
      <div style={{ fontSize: 12, color: T.textMut, textAlign: "center", padding: 20 }}>
        Conectar con GET /api/v1/turnos?fecha=hoy
      </div>
    </div>
  );
}
