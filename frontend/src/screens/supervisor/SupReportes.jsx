import { useState, useEffect } from "react";
import { T } from "../../theme/theme";
import { Btn } from "../../components/ui/Btn";
import { Input } from "../../components/ui/Input";
import { SubHeader } from "../../components/ui/SubHeader";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuth } from "../../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3005/api/v1";

// ─── CARGA DINÁMICA DE jsPDF + autoTable ─────────────────────────
async function cargarLibsPDF() {
  if (window.jspdf?.jsPDF?.prototype?.autoTable) return window.jspdf.jsPDF;

  await new Promise((ok, fail) => {
    if (window.jspdf?.jsPDF) { ok(); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });

  await new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
    s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });

  return window.jspdf.jsPDF;
}

// ─── GENERADOR PDF OS-10 ─────────────────────────────────────────
async function generarPDFOS10({ asistencias, novedades, instNombre, fechaInicio, fechaFin, autorNombre }) {
  const JsPDF = await cargarLibsPDF();
  const doc   = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW    = doc.internal.pageSize.getWidth();

  // ── Cabecera ──────────────────────────────────────────────────
  doc.setFillColor(6, 13, 24);         // bg
  doc.rect(0, 0, PW, 38, "F");

  doc.setFillColor(0, 229, 176);       // raya acento
  doc.rect(0, 38, PW, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(0, 229, 176);
  doc.text("GEO CONSTANZA", 14, 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(122, 143, 168);
  doc.text("SISTEMA DE GESTIÓN OPERACIONAL DE SEGURIDAD PRIVADA", 14, 24);

  doc.setFillColor(26, 45, 74);
  doc.rect(0, 40, PW, 13, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(228, 234, 242);
  doc.text("REPORTE OS-10  ·  REGISTRO DE OPERACIONES Y ASISTENCIA", 14, 49);

  // ── Metadatos del reporte ─────────────────────────────────────
  const hoy = new Date().toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 100, 130);

  let y = 64;
  const campo = (label, valor) => {
    doc.setFont("helvetica", "bold"); doc.text(label, 14, y);
    doc.setFont("helvetica", "normal"); doc.text(valor, 55, y);
    y += 6;
  };
  campo("Instalación:",    instNombre     || "Todas las instalaciones");
  campo("Período:",        `${fechaInicio || "—"} al ${fechaFin || "—"}`);
  campo("Generado:",       hoy);
  campo("Responsable:",    autorNombre    || "Sistema Geo Constanza");
  campo("N° Registros:",   `${asistencias.length} asistencias · ${novedades.length} novedades`);

  // ── Sección 1: Asistencia ─────────────────────────────────────
  y += 4;
  doc.setFillColor(13, 26, 45);
  doc.rect(0, y, PW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 229, 176);
  doc.text("1.  REGISTRO DE ASISTENCIA", 14, y + 5.5);
  y += 12;

  if (asistencias.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(122, 143, 168);
    doc.text("Sin registros de asistencia para el período seleccionado.", 14, y);
    y += 10;
  } else {
    const filas = asistencias.map((a) => [
      new Date(a.hora_entrada).toLocaleDateString("es-CL"),
      a.usuario?.rut  || "—",
      a.usuario?.nombre || "—",
      a.instalacion?.nombre || "—",
      `${a.turno?.hora_inicio || "—"} – ${a.turno?.hora_fin || "—"}`,
      new Date(a.hora_entrada).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
      a.hora_salida ? new Date(a.hora_salida).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "Activo",
      a.estado === "tardio" ? "Tardío" : "Normal",
      a.minutos_retraso > 0 ? `${a.minutos_retraso} min` : "—",
    ]);

    doc.autoTable({
      startY: y,
      head: [["Fecha", "RUT", "Nombre", "Instalación", "Horario", "Entrada", "Salida", "Estado", "Retraso"]],
      body: filas,
      styles:       { fontSize: 7.5, cellPadding: 2.5, font: "helvetica", textColor: [60, 80, 100] },
      headStyles:   { fillColor: [10, 22, 40], textColor: [228, 234, 242], fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: {
        0: { cellWidth: 18 }, 1: { cellWidth: 22 }, 3: { cellWidth: 28 },
        4: { cellWidth: 24 }, 5: { cellWidth: 16 }, 6: { cellWidth: 16 },
        7: { cellWidth: 15 }, 8: { cellWidth: 16 },
      },
      margin: { left: 14, right: 14 },
      tableLineColor: [200, 215, 230], tableLineWidth: 0.2,
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Sección 2: Novedades ──────────────────────────────────────
  const URGENCIA_LABEL = { rojo: "CRÍTICO", amarillo: "MEDIO", verde: "BAJO" };

  if (y > 230) doc.addPage();

  doc.setFillColor(13, 26, 45);
  doc.rect(0, y, PW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 229, 176);
  doc.text("2.  NOVEDADES DEL PERÍODO", 14, y + 5.5);
  y += 12;

  if (novedades.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(122, 143, 168);
    doc.text("Sin novedades registradas para el período seleccionado.", 14, y);
    y += 10;
  } else {
    const filas = novedades.map((n) => [
      new Date(n.created_at).toLocaleDateString("es-CL"),
      n.tipo || "—",
      URGENCIA_LABEL[n.urgencia] || n.urgencia || "—",
      n.descripcion?.substring(0, 60) + (n.descripcion?.length > 60 ? "…" : "") || "—",
      n.usuario?.nombre || "—",
      n.instalacion?.nombre || "—",
      n.estado === "resuelta" ? "Resuelta" : n.estado === "escalada" ? "Escalada" : "Abierta",
    ]);

    const urgenciaColor = (u) => {
      if (u === "CRÍTICO") return [220, 50, 80];
      if (u === "MEDIO")   return [200, 140, 20];
      return [20, 160, 100];
    };

    doc.autoTable({
      startY: y,
      head: [["Fecha", "Tipo", "Urgencia", "Descripción", "Guardia", "Instalación", "Estado"]],
      body: filas,
      styles:     { fontSize: 7.5, cellPadding: 2.5, font: "helvetica", textColor: [60, 80, 100] },
      headStyles: { fillColor: [10, 22, 40], textColor: [228, 234, 242], fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: {
        0: { cellWidth: 18 }, 1: { cellWidth: 22 }, 2: { cellWidth: 18 },
        3: { cellWidth: 50 }, 4: { cellWidth: 26 }, 5: { cellWidth: 30 }, 6: { cellWidth: 18 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          data.cell.styles.textColor = urgenciaColor(data.cell.raw);
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: 14, right: 14 },
      tableLineColor: [200, 215, 230], tableLineWidth: 0.2,
    });
  }

  // ── Pie de página en todas las páginas ───────────────────────
  const totalPags = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p);
    const pH = doc.internal.pageSize.getHeight();
    doc.setFillColor(6, 13, 24);
    doc.rect(0, pH - 12, PW, 12, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(74, 94, 120);
    doc.text("Geo Constanza · Sistema de Gestión Operacional de Seguridad Privada", 14, pH - 5);
    doc.text(`Página ${p} de ${totalPags}`, PW - 14, pH - 5, { align: "right" });
  }

  // ── Descargar ─────────────────────────────────────────────────
  const nombre = `OS10_${(instNombre || "General").replace(/\s+/g, "_")}_${fechaInicio || "Sin_Fecha"}.pdf`;
  doc.save(nombre);
}

// ─── COMPONENTE TABLA PREVIEW ─────────────────────────────────────
function TablaPreview({ datos, tipo }) {
  if (!datos || datos.length === 0) return (
    <div style={{ textAlign: "center", padding: 20, fontSize: 12, color: T.textMut }}>
      Sin registros para el período seleccionado.
    </div>
  );

  if (tipo === "asistencia") {
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: T.bgInput }}>
              {["Fecha", "RUT", "Nombre", "Instalación", "Entrada", "Salida", "Estado", "Retraso"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: T.textSec, fontWeight: 700, fontSize: 10, letterSpacing: 0.8, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.slice(0, 50).map((a, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.border}22` }}>
                <td style={tdStyle}>{new Date(a.hora_entrada).toLocaleDateString("es-CL")}</td>
                <td style={tdStyle}>{a.usuario?.rut || "—"}</td>
                <td style={tdStyle}>{a.usuario?.nombre || "—"}</td>
                <td style={tdStyle}>{a.instalacion?.nombre || "—"}</td>
                <td style={tdStyle}>{new Date(a.hora_entrada).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</td>
                <td style={tdStyle}>{a.hora_salida ? new Date(a.hora_salida).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : <span style={{ color: T.accent, fontSize: 10 }}>Activo</span>}</td>
                <td style={tdStyle}>
                  <span style={{ color: a.estado === "tardio" ? T.yellow : T.accent, fontWeight: 700, fontSize: 10 }}>
                    {a.estado === "tardio" ? "Tardío" : "Normal"}
                  </span>
                </td>
                <td style={tdStyle}>{a.minutos_retraso > 0 ? `${a.minutos_retraso} min` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {datos.length > 50 && (
          <div style={{ textAlign: "center", padding: 10, fontSize: 11, color: T.textMut }}>
            Mostrando 50 de {datos.length} registros. El PDF incluirá todos.
          </div>
        )}
      </div>
    );
  }

  // Novedades
  const URGENCIA = { rojo: { label: "Crítico", color: T.red }, amarillo: { label: "Medio", color: T.yellow }, verde: { label: "Bajo", color: T.accent } };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: T.bgInput }}>
            {["Fecha", "Tipo", "Urgencia", "Descripción", "Guardia", "Instalación", "Estado"].map((h) => (
              <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: T.textSec, fontWeight: 700, fontSize: 10, letterSpacing: 0.8, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.slice(0, 50).map((n, i) => {
            const u = URGENCIA[n.urgencia] || { label: n.urgencia, color: T.textMut };
            return (
              <tr key={i} style={{ borderBottom: `1px solid ${T.border}22` }}>
                <td style={tdStyle}>{new Date(n.created_at).toLocaleDateString("es-CL")}</td>
                <td style={tdStyle}>{n.tipo || "—"}</td>
                <td style={tdStyle}><span style={{ color: u.color, fontWeight: 700, fontSize: 10 }}>{u.label}</span></td>
                <td style={{ ...tdStyle, maxWidth: 180 }}>{n.descripcion?.substring(0, 60)}{n.descripcion?.length > 60 ? "…" : ""}</td>
                <td style={tdStyle}>{n.usuario?.nombre || "—"}</td>
                <td style={tdStyle}>{n.instalacion?.nombre || "—"}</td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 10, color: n.estado === "resuelta" ? T.accent : n.estado === "escalada" ? T.red : T.yellow, fontWeight: 700 }}>
                    {n.estado === "resuelta" ? "Resuelta" : n.estado === "escalada" ? "Escalada" : "Abierta"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const tdStyle = { padding: "7px 10px", color: T.text, verticalAlign: "middle" };

// ─── SELECTOR GENÉRICO ────────────────────────────────────────────
function Select({ label, value, onChange, options, placeholder }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.textSec, marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", background: T.bgInput, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", color: value ? T.text : T.textMut, fontSize: 14, fontFamily: "'Outfit', sans-serif", outline: "none" }}
      >
        <option value="">{placeholder || "Seleccionar..."}</option>
        {options.map((o) => <option key={o.value} value={o.value} style={{ background: T.bgCard }}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── PANTALLA PRINCIPAL ───────────────────────────────────────────
export function SupReportes() {
  const { token, user } = useAuth();
  const [instalaciones,  setInstalaciones]  = useState([]);
  const [instalacionId,  setInstalacionId]  = useState("");
  const [fechaInicio,    setFechaInicio]    = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split("T")[0]);
  const [vistaActiva,    setVistaActiva]    = useState("asistencia"); // "asistencia" | "novedades"
  const [datos,          setDatos]          = useState(null);
  const [cargando,       setCargando]       = useState(false);
  const [exportando,     setExportando]     = useState(false);
  const [error,          setError]          = useState("");

  // Cargar instalaciones al montar
  useEffect(() => {
    fetch(`${API_BASE}/instalaciones`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setInstalaciones(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => {});
  }, [token]);

  const buildQS = () => {
    const p = new URLSearchParams();
    if (instalacionId) p.set("instalacion_id", instalacionId);
    if (fechaInicio)   p.set("fecha_inicio", fechaInicio);
    if (fechaFin)      p.set("fecha_fin",    fechaFin);
    return p.toString();
  };

  const consultar = async () => {
    setError(""); setCargando(true); setDatos(null);
    const endpoint = vistaActiva === "asistencia" ? "asistencia" : "incidentes";
    try {
      const res  = await fetch(`${API_BASE}/reportes/${endpoint}?${buildQS()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al consultar");
      setDatos(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const exportarCSV = () => {
    const url = `${API_BASE}/reportes/exportar/csv?${buildQS()}`;
    const a   = document.createElement("a");
    a.href    = `${url}`;
    a.download = `reporte_geo_constanza.csv`;
    // Necesita Authorization header — fetch + Blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        a.href = URL.createObjectURL(blob);
        a.click();
      })
      .catch(() => setError("Error al descargar CSV"));
  };

  const exportarPDF = async () => {
    setExportando(true); setError("");
    try {
      // Asegurarse de tener ambos datasets
      const [resA, resN] = await Promise.all([
        fetch(`${API_BASE}/reportes/asistencia?${buildQS()}`,  { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/reportes/incidentes?${buildQS()}`,  { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [asistencias, novedades] = await Promise.all([resA.json(), resN.json()]);

      const instNombre = instalaciones.find((i) => i.id === instalacionId)?.nombre || "";

      await generarPDFOS10({
        asistencias: Array.isArray(asistencias) ? asistencias : [],
        novedades:   Array.isArray(novedades)   ? novedades   : [],
        instNombre,
        fechaInicio,
        fechaFin,
        autorNombre: user?.nombre,
      });
    } catch (e) {
      setError("Error al generar PDF: " + e.message);
    } finally {
      setExportando(false);
    }
  };

  const instNombreActual = instalaciones.find((i) => i.id === instalacionId)?.nombre || "Todas";

  return (
    <div>
      <SectionHeader title="Reportes OS-10" sub="Informes operacionales para fiscalización" />

      {/* Filtros */}
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <SubHeader title="Parámetros del Reporte" />

        <Select
          label="Instalación"
          value={instalacionId}
          onChange={setInstalacionId}
          placeholder="Todas las instalaciones"
          options={instalaciones.map((i) => ({ value: i.id, label: i.nombre }))}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Fecha Inicio" type="date" value={fechaInicio} onChange={setFechaInicio} />
          <Input label="Fecha Fin"    type="date" value={fechaFin}    onChange={setFechaFin}    />
        </div>

        {/* Tabs: Asistencia / Novedades */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { id: "asistencia", label: "📋 Asistencia" },
            { id: "novedades",  label: "🚨 Novedades"  },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setVistaActiva(tab.id)} style={{
              padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "'Outfit', sans-serif",
              background: vistaActiva === tab.id ? T.accent : T.bgInput,
              color:      vistaActiva === tab.id ? T.bg     : T.textMut,
              border:     vistaActiva === tab.id ? "none"   : `1px solid ${T.border}`,
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        <Btn full onClick={consultar} loading={cargando}>
          Consultar {vistaActiva === "asistencia" ? "Asistencia" : "Novedades"}
        </Btn>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: T.redGhost, border: `1px solid ${T.red}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: T.red }}>
          {error}
        </div>
      )}

      {/* Resultados */}
      {datos !== null && (
        <>
          {/* Resumen rápido */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                {datos.length} registro{datos.length !== 1 ? "s" : ""} encontrado{datos.length !== 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 11, color: T.textMut, marginTop: 2 }}>
                {instNombreActual} · {fechaInicio} al {fechaFin}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={exportarCSV} style={{
                background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8,
                padding: "7px 12px", color: T.textSec, fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "'Outfit', sans-serif",
              }}>
                📊 Excel
              </button>
              <button onClick={exportarPDF} disabled={exportando} style={{
                background: exportando ? T.textMut : T.accent, border: "none", borderRadius: 8,
                padding: "7px 14px", color: T.bg, fontSize: 11, fontWeight: 700,
                cursor: exportando ? "not-allowed" : "pointer", fontFamily: "'Outfit', sans-serif",
                boxShadow: exportando ? "none" : `0 2px 12px rgba(0,229,176,.3)`,
              }}>
                {exportando ? "⏳ Generando..." : "📑 PDF OS-10"}
              </button>
            </div>
          </div>

          {/* Tabla preview */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            <TablaPreview datos={datos} tipo={vistaActiva} />
          </div>
        </>
      )}
    </div>
  );
}
