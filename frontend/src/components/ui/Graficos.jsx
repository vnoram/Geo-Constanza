import { Bar, BarChart, CartesianGrid, Cell, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FONT, T } from "../../theme/theme";
import { ahoraChile } from "../../utils/fechaChile";

const URGENCIAS = [
  { clave: "rojo", etiqueta: "Críticas", color: T.red },
  { clave: "amarillo", etiqueta: "Medias", color: T.yellow },
  { clave: "verde", etiqueta: "Bajas", color: T.accent },
];

const eje = { fontSize: 11, fill: T.textMut, fontFamily: FONT.ui };
const cajaTooltip = {
  background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius,
  fontSize: 12, color: T.text, fontFamily: FONT.ui, boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
};

/** Etiqueta del eje X: el día actual va en negrita y color de acento. */
function EtiquetaDia({ x, y, payload, hoy, texto }) {
  const esHoy = hoy !== undefined && payload.value === hoy;
  return (
    <text x={x} y={y + 12} textAnchor="middle"
      style={{ ...eje, textTransform: "capitalize", fill: esHoy ? T.accent : T.textMut, fontWeight: esHoy ? 700 : 400 }}>{esHoy && texto ? texto : payload.value}</text>
  );
}

const colorCobertura = (c) => (c >= 90 ? T.accent : c >= 70 ? T.yellow : T.red);

/** Novedades por día, apiladas por urgencia (últimos 7 días). */
export function GraficoNovedades({ semana, alto = 180, leyenda = true }) {
  const datos = semana.map((d) => ({ ...d, dia: String(d.label).slice(0, 3) }));
  const diaHoy = datos.find((d) => d.fecha === ahoraChile().fecha)?.dia;
  return (
    <div>
      <div style={{ width: "100%", height: alto }}>
        <ResponsiveContainer>
          <BarChart data={datos} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={T.border} strokeDasharray="3 3" />
            {diaHoy && <ReferenceArea x1={diaHoy} x2={diaHoy} fill={T.accent} fillOpacity={0.12} stroke={T.accent} strokeOpacity={0.35} />}
            <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={(p) => <EtiquetaDia {...p} hoy={diaHoy} texto="hoy" />} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={eje} />
            <Tooltip cursor={{ fill: T.bgHover ?? "rgba(255,255,255,0.04)" }} contentStyle={cajaTooltip} itemStyle={{ color: T.text }} labelStyle={{ color: T.textSec, textTransform: "capitalize" }}
              labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""}
              itemSorter={(item) => URGENCIAS.findIndex((u) => u.clave === item.dataKey)} />
            {URGENCIAS.map((u, i) => (
              <Bar key={u.clave} dataKey={u.clave} name={u.etiqueta} stackId="n" fill={u.color}
                radius={i === URGENCIAS.length - 1 ? [3, 3, 0, 0] : 0} maxBarSize={34} isAnimationActive animationDuration={500} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {leyenda && (
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, color: T.textMut }}>
          {URGENCIAS.map((u) => <span key={u.clave}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: u.color, marginRight: 5 }} />{u.etiqueta}</span>)}
        </div>
      )}
    </div>
  );
}

/** Cobertura (%) por instalación, barras horizontales coloreadas según el umbral. */
export function GraficoCobertura({ filas }) {
  const datos = filas.map((f) => ({ nombre: f.instalacion, cobertura: f.cobertura }));
  const alto = Math.max(70, datos.length * 34 + 10);
  return (
    <div style={{ width: "100%", height: alto }}>
      <ResponsiveContainer>
        <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 34, left: 0, bottom: 0 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="nombre" width={110} tickLine={false} axisLine={false} tick={{ ...eje, fill: T.text }}
            tickFormatter={(v) => (String(v).length > 14 ? `${String(v).slice(0, 13)}…` : v)} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={cajaTooltip} itemStyle={{ color: T.text }} formatter={(v) => [`${v}%`, "Cobertura"]} />
          <Bar dataKey="cobertura" radius={[0, 4, 4, 0]} barSize={12} background={{ fill: T.bg, radius: 4 }}
            label={{ position: "right", fontSize: 11, fill: T.text, fontFamily: FONT.mono, formatter: (v) => `${v}%` }} animationDuration={500}>
            {datos.map((d) => <Cell key={d.nombre} fill={colorCobertura(d.cobertura)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Cobertura (%) de cada día del período para una instalación. */
export function GraficoCoberturaDiaria({ dias, alto = 150 }) {
  const datos = dias.map((d) => ({ ...d, dia: Number(d.fecha.slice(8, 10)) }));
  const diaHoy = datos.find((d) => d.fecha === ahoraChile().fecha)?.dia;
  return (
    <div style={{ width: "100%", height: alto }}>
      <ResponsiveContainer>
        <BarChart data={datos} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={T.border} strokeDasharray="3 3" />
          {diaHoy !== undefined && <ReferenceArea x1={diaHoy} x2={diaHoy} fill={T.accent} fillOpacity={0.12} stroke={T.accent} strokeOpacity={0.35} />}
          <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={(p) => <EtiquetaDia {...p} hoy={diaHoy} />} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={eje} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={cajaTooltip} itemStyle={{ color: T.text }} labelStyle={{ color: T.textSec }}
            labelFormatter={(_, p) => (p?.[0]?.payload?.fecha ? p[0].payload.fecha.split("-").reverse().join("-") : "")}
            formatter={(v, _n, p) => [`${v}% (${p.payload.turnos_cubiertos} de ${p.payload.turnos_programados} turnos)`, "Cobertura"]} />
          <Bar dataKey="cobertura" radius={[3, 3, 0, 0]} maxBarSize={22} animationDuration={500}>
            {datos.map((d) => <Cell key={d.fecha} fill={colorCobertura(d.cobertura)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
