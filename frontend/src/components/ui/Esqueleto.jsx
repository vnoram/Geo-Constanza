/** Marcador de carga con brillo suave: reemplaza a los textos «Cargando…». */
export function Esqueleto({ filas = 3, alto = 14, gap = 12, ancho }) {
  return (
    <div role="status" aria-label="Cargando" style={{ display: "flex", flexDirection: "column", gap, padding: 16, width: ancho }}>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="esqueleto" style={{ height: alto, width: i === filas - 1 && filas > 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}
