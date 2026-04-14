import { useEffect, useState } from "react";
import { T } from "../../theme/theme";
import { Badge } from "../../components/ui/Badge";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { api } from "../../services/api";

// Convierte "19:00"/"07:00" en texto legible indicando si termina al día siguiente
function formatHorario(inicio, fin) {
  const nocturno = fin < inicio;
  return `${inicio} — ${fin}${nocturno ? " (+1)" : ""}`;
}

// Agrupa turnos consecutivos del mismo ciclo 4x4 para mostrar el bloque
function agruparCiclos(turnos) {
  if (!turnos.length) return [];
  // Ordena por fecha (ya vienen ordenados del backend, pero por si acaso)
  const ordenados = [...turnos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const grupos = [];
  let bloque = [ordenados[0]];

  for (let i = 1; i < ordenados.length; i++) {
    const prev = new Date(ordenados[i - 1].fecha);
    const curr = new Date(ordenados[i].fecha);
    const diffDias = Math.round((curr - prev) / 86400000);
    // Si la diferencia es ≤ 4 días, pertenece al mismo bloque de trabajo
    if (diffDias <= 4) {
      bloque.push(ordenados[i]);
    } else {
      grupos.push(bloque);
      bloque = [ordenados[i]];
    }
  }
  grupos.push(bloque);
  return grupos;
}

function TurnoRow({ turno }) {
  const fecha = new Date(turno.fecha);
  const fechaStr = fecha.toLocaleDateString("es-CL", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    timeZone: "UTC",
  });

  const estadoColor = {
    programado: "accent",
    completado: "accent",
    cancelado:  "red",
  }[turno.estado] || "yellow";

  const nocturno = turno.hora_fin < turno.hora_inicio;

  return (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: "12px 16px", marginBottom: 6,
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{fechaStr}</span>
          {nocturno && (
            <span style={{ fontSize: 10, color: "#c4a8ff", background: "#1a1230", borderRadius: 4, padding: "1px 5px" }}>
              🌙 nocturno
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: T.textSec }}>
          {formatHorario(turno.hora_inicio, turno.hora_fin)}
        </div>
        {turno.instalacion?.nombre && (
          <div style={{ fontSize: 11, color: T.textMut, marginTop: 2 }}>
            📍 {turno.instalacion.nombre}
          </div>
        )}
      </div>
      <Badge color={estadoColor}>{turno.estado}</Badge>
    </div>
  );
}

function BloqueCard({ turnos, numeroCiclo }) {
  const primera = new Date(turnos[0].fecha);
  const ultima  = new Date(turnos[turnos.length - 1].fecha);
  const rangoStr = `${primera.toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "UTC" })} → ${ultima.toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "UTC" })}`;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
      }}>
        <div style={{
          background: T.accentGhost, borderRadius: 6, padding: "3px 10px",
          fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: 0.8,
        }}>
          BLOQUE {numeroCiclo}
        </div>
        <span style={{ fontSize: 11, color: T.textMut }}>{rangoStr} · {turnos.length} días de trabajo</span>
      </div>
      {turnos.map((t) => <TurnoRow key={t.id} turno={t} />)}
    </div>
  );
}

export function LibreTurnos() {
  const [turnos, setTurnos]   = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      setError("");
      try {
        const data = await api.get("/turnos");
        // El backend puede devolver array plano o paginado
        const lista = Array.isArray(data) ? data : (data.data ?? []);
        // Filtrar sólo los no cancelados y ordenar por fecha
        const vigentes = lista
          .filter((t) => t.estado !== "cancelado")
          .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        setTurnos(vigentes);
      } catch (e) {
        setError("No se pudieron cargar los turnos. Intenta de nuevo.");
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  const ciclos = agruparCiclos(turnos);

  return (
    <div>
      <SectionHeader
        title="Mis Turnos"
        sub={turnos.length > 0 ? `${turnos.length} turno${turnos.length !== 1 ? "s" : ""} programado${turnos.length !== 1 ? "s" : ""}` : "Próximos 60 días"}
      />

      {cargando && (
        <div style={{ textAlign: "center", padding: 40, fontSize: 13, color: T.textMut }}>
          Cargando turnos...
        </div>
      )}

      {!cargando && error && (
        <div style={{
          background: T.redGhost, border: `1px solid ${T.red}`,
          borderRadius: 10, padding: "10px 14px", fontSize: 13, color: T.red, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {!cargando && !error && turnos.length === 0 && (
        <div style={{ textAlign: "center", padding: 50 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>
            Sin turnos asignados
          </div>
          <div style={{ fontSize: 12, color: T.textMut }}>
            Tu supervisor aún no ha generado una pauta para ti.
          </div>
        </div>
      )}

      {!cargando && !error && ciclos.length > 0 && (
        <div>
          {ciclos.map((bloque, idx) => (
            <BloqueCard key={idx} turnos={bloque} numeroCiclo={idx + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
