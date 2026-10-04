import { useEffect, useRef, useState } from "react";
import { T } from "../../theme/theme";
import { buscarDirecciones } from "../../services/geocoding";

const DEBOUNCE_MS = 600;
const MIN_CARACTERES = 4;

// ─── CAMPO DIRECCIÓN CON AUTOCOMPLETADO (GEOCODING) ──────────────
// Mientras el usuario escribe se consultan sugerencias; al elegir una
// se invoca onSeleccion({ direccion, comuna, latitud, longitud }).
export function DireccionAutocomplete({ label, value, onChange, comuna, onSeleccion, placeholder, error }) {
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [sinResultados, setSinResultados] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activa, setActiva] = useState(-1);
  // Último texto tecleado: sólo se busca si el valor viene del teclado,
  // no cuando se completa desde el mapa, una sugerencia o al abrir en edición
  const tecleadoRef = useRef(null);

  useEffect(() => {
    const texto = value.trim();
    if (value !== tecleadoRef.current || texto.length < MIN_CARACTERES) {
      setSugerencias([]);
      setSinResultados(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const consulta = comuna?.trim() ? `${texto}, ${comuna.trim()}` : texto;
        const res = await buscarDirecciones(consulta, { signal: ctrl.signal });
        setSugerencias(res);
        setSinResultados(res.length === 0);
        setActiva(-1);
        setAbierto(true);
      } catch (err) {
        if (err.name !== "AbortError") {
          setSugerencias([]);
          setSinResultados(false);
        }
      } finally {
        if (!ctrl.signal.aborted) setBuscando(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, comuna]);

  const elegir = (s) => {
    tecleadoRef.current = null;
    setAbierto(false);
    setSugerencias([]);
    onSeleccion(s);
  };

  const onKeyDown = (e) => {
    if (!abierto || sugerencias.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiva((i) => (i + 1) % sugerencias.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiva((i) => (i <= 0 ? sugerencias.length - 1 : i - 1));
    } else if (e.key === "Enter" && activa >= 0) {
      e.preventDefault();
      elegir(sugerencias[activa]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  const mostrarLista = abierto && focused && (sugerencias.length > 0 || sinResultados);

  return (
    <div style={{ marginBottom: 18, position: "relative" }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 700,
            color: T.textSec,
            marginBottom: 6,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: T.bgInput,
          border: `1.5px solid ${error ? T.red : focused ? T.borderFocus : T.border}`,
          borderRadius: 8,
          padding: "12px 14px",
          transition: "all 0.25s",
          boxShadow: focused ? `0 0 0 3px ${T.accentGhost}` : "none",
        }}
      >
        <span style={{ fontSize: 18, opacity: 0.5 }}>📍</span>
        <input
          value={value}
          onChange={(e) => {
            tecleadoRef.current = e.target.value;
            onChange(e.target.value);
          }}
          onFocus={() => {
            setFocused(true);
            if (sugerencias.length) setAbierto(true);
          }}
          // Retraso para que el click en una sugerencia alcance a registrarse
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            flex: 1,
            minWidth: 0,
            background: "none",
            border: "none",
            outline: "none",
            color: T.text,
            fontSize: 15,
            fontFamily: "var(--font-ui)",
          }}
        />
        {buscando && <span style={{ fontSize: 11, color: T.textMut, whiteSpace: "nowrap" }}>Buscando…</span>}
      </div>
      {error && <div style={{ fontSize: 12, color: T.red, marginTop: 5, fontWeight: 500 }}>{error}</div>}

      {mostrarLista && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            zIndex: 20,
            background: T.bgCard,
            border: `1.5px solid ${T.border}`,
            borderRadius: 8,
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
            overflow: "hidden",
          }}
        >
          {sinResultados ? (
            <div style={{ padding: "10px 14px", fontSize: 12, color: T.textMut }}>
              Sin coincidencias. Prueba agregando la comuna o marca el punto directamente en el mapa.
            </div>
          ) : (
            sugerencias.map((s, i) => (
              <button
                key={`${s.latitud},${s.longitud},${i}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(s)}
                onMouseEnter={() => setActiva(i)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: i === activa ? T.bgCardHover : "transparent",
                  border: "none",
                  borderBottom: i < sugerencias.length - 1 ? `1px solid ${T.border}` : "none",
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontFamily: "var(--font-ui)",
                }}
              >
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>
                  {s.direccion}
                  {s.comuna && <span style={{ color: T.accent, fontWeight: 500 }}> · {s.comuna}</span>}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: T.textMut,
                    marginTop: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.etiqueta}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
