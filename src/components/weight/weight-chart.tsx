import { trendKg, type WeightPoint } from "@/lib/body";
import { daysBetween, parseDate } from "@/lib/dates";

const W = 320;
const H = 168;
const PAD = { left: 38, right: 10, top: 14, bottom: 26 };

/**
 * Evolución del peso: puntos de cada pesaje, línea de tendencia (promedio móvil exponencial) y la meta.
 * SVG propio para no sumar una librería de gráficos. `logs` va en orden cronológico.
 */
export function WeightChart({
  logs,
  goalKg,
  locale,
  label,
}: {
  logs: WeightPoint[];
  goalKg: number | null;
  locale: string;
  label: string;
}) {
  if (logs.length < 2) return null;

  const first = logs[0].on;
  const last = logs[logs.length - 1].on;
  const span = Math.max(1, daysBetween(first, last));
  const trend = logs.map((_, i) => trendKg(logs.slice(0, i + 1)) ?? logs[i].kg);

  const data = [...logs.map((l) => l.kg), ...trend];
  const dataMin = Math.min(...data);
  const dataMax = Math.max(...data);
  // La meta solo entra en el rango si está cerca de los datos; si está muy lejos aplastaría la curva y se
  // indica con una marca en el borde del gráfico.
  const reach = Math.max(3, (dataMax - dataMin) * 1.5);
  const goalNear = goalKg != null && goalKg >= dataMin - reach && goalKg <= dataMax + reach;
  const values = goalNear ? [...data, goalKg] : data;
  let min = Math.min(...values);
  let max = Math.max(...values);
  const pad = Math.max(0.5, (max - min) * 0.15);
  min -= pad;
  max += pad;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (on: string) => PAD.left + (daysBetween(first, on) / span) * plotW;
  const y = (kg: number) => PAD.top + (1 - (kg - min) / (max - min)) * plotH;

  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  const dateFmt = (on: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "2-digit" }), timeZone: "UTC" }).format(parseDate(on));

  const trendPath = logs.map((l, i) => `${i === 0 ? "M" : "L"}${x(l.on).toFixed(1)},${y(trend[i]).toFixed(1)}`).join(" ");
  const lastLog = logs[logs.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
      {/* Extremos del eje vertical */}
      {[max - pad, min + pad].map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray="2 3" />
          <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {nf.format(v)}
          </text>
        </g>
      ))}

      {goalKg != null && !goalNear && (
        <text x={W - PAD.right} y={goalKg < dataMin ? H - PAD.bottom - 4 : PAD.top + 10} textAnchor="end" className="fill-emerald-600 text-[10px] font-medium dark:fill-emerald-400">
          {goalKg < dataMin ? "▼" : "▲"} {nf.format(goalKg)}
        </text>
      )}
      {goalKg != null && goalNear && (
        <g>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(goalKg)} y2={y(goalKg)} className="stroke-emerald-500" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={W - PAD.right} y={y(goalKg) - 4} textAnchor="end" className="fill-emerald-600 text-[10px] font-medium dark:fill-emerald-400">
            {nf.format(goalKg)}
          </text>
        </g>
      )}

      <path d={trendPath} fill="none" className="stroke-primary" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
      {logs.map((l) => (
        <circle key={l.on} cx={x(l.on)} cy={y(l.kg)} r={2.5} className="fill-muted-foreground/60" />
      ))}
      <circle cx={x(lastLog.on)} cy={y(trend[trend.length - 1])} r={4} className="fill-primary stroke-background" strokeWidth={1.5} />
      <text x={Math.min(x(lastLog.on), W - PAD.right - 14)} y={y(trend[trend.length - 1]) - 8} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
        {nf.format(trend[trend.length - 1])}
      </text>

      {/* Fechas de los extremos */}
      <text x={PAD.left} y={H - 8} textAnchor="start" className="fill-muted-foreground text-[10px]">{dateFmt(first)}</text>
      <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[10px]">{dateFmt(last)}</text>
    </svg>
  );
}
