import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import type { ScorecardMeasurement, ScorecardMetric, ScorecardMilestone } from '@workspace/api-client-react';
import { dayLabel, fmtNum, stampLabel } from '@/lib/scorecard-tracker';

const NAVY = '#0A2540', BLUE = '#1D8BC4', AMBER = '#ECA519';
const dayTs = (iso: string) => Date.parse(iso + 'T12:00:00Z');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Pt = { t: number; v: number; label: string; kind: 'value' | 'target' | 'upper'; note?: string };

/** Elapsed-time x axis: entries are spaced by when they were recorded, not by index. */
export function TrendChart({ metric, entries, milestones, today }: {
  metric: ScorecardMetric; entries: ScorecardMeasurement[]; milestones: ScorecardMilestone[]; today: string;
}) {
  const values: Pt[] = entries.filter((e) => typeof e.value === 'number').map((e) => ({ t: Date.parse(e.recordedAt), v: e.value as number, label: stampLabel(e.recordedAt), kind: 'value', note: e.note }));
  const targets: Pt[] = milestones.map((m) => ({ t: dayTs(m.dueDate), v: m.target, label: dayLabel(m.dueDate), kind: 'target' }));
  const uppers: Pt[] = metric.direction === 'range' ? milestones.filter((m) => m.upperTarget != null).map((m) => ({ t: dayTs(m.dueDate), v: m.upperTarget as number, label: dayLabel(m.dueDate), kind: 'upper' })) : [];
  const todayT = dayTs(today);
  const xs = [...values, ...targets].map((p) => p.t).concat(todayT);
  let lo = Math.min(...xs), hi = Math.max(...xs);
  if (hi - lo < 86_400_000 * 6) { lo -= 86_400_000 * 3; hi += 86_400_000 * 3; }
  const pad = (hi - lo) * 0.04;
  const standing = milestones.length === 0;
  const d = metric.decimals;
  const span = hi - lo;
  const tick = (t: number) => { const x = new Date(t); return span > 400 * 86_400_000 ? `${MON[x.getUTCMonth()]} ${x.getUTCFullYear()}` : `${MON[x.getUTCMonth()]} ${x.getUTCDate()}`; };

  return (
    <div className="h-[300px] w-full" data-testid="chart-metric-trend">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 12, right: 18, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={NAVY} strokeOpacity={0.07} vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={[lo - pad, hi + pad]} tickFormatter={tick} tick={{ fontSize: 11, fill: '#3A4E63' }} stroke="#0A254033" minTickGap={28} allowDuplicatedCategory={false} />
          <YAxis dataKey="v" type="number" domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#3A4E63', fontFamily: 'var(--font-mono, monospace)' }} stroke="#0A254033" width={56} tickFormatter={(v: number) => fmtNum(v, d)} />
          <Tooltip cursor={{ stroke: BLUE, strokeOpacity: 0.3 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Pt;
              return (
                <div className="max-w-[240px] rounded-lg border border-[#0A2540]/12 bg-[#FBFAF6] px-3 py-2 text-[12px] shadow-md">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[#3A4E63]">{p.kind === 'value' ? 'Recorded' : p.kind === 'upper' ? 'Upper bound due' : 'Target due'} {p.label}</div>
                  <div className="font-mono text-[15px] font-semibold text-[#0A2540]">{fmtNum(p.v, d)} {metric.unit}</div>
                  {p.note ? <div className="mt-0.5 line-clamp-3 text-[#3A4E63]">{p.note}</div> : null}
                </div>
              );
            }} />
          {standing && <ReferenceLine y={metric.target} stroke={AMBER} strokeDasharray="5 4" label={{ value: metric.direction === 'range' ? 'Lower' : 'Goal', position: 'insideTopLeft', fontSize: 10, fill: '#8A5A00' }} />}
          {standing && metric.direction === 'range' && metric.upperTarget != null && <ReferenceLine y={metric.upperTarget} stroke={AMBER} strokeDasharray="5 4" label={{ value: 'Upper', position: 'insideTopLeft', fontSize: 10, fill: '#8A5A00' }} />}
          <ReferenceLine x={todayT} stroke={NAVY} strokeOpacity={0.35} strokeDasharray="2 3" label={{ value: 'Today', position: 'insideTopRight', fontSize: 10, fill: '#3A4E63' }} />
          {targets.length > 0 && <Line data={targets} dataKey="v" type="stepAfter" stroke={AMBER} strokeOpacity={0.55} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} name="Target" />}
          {uppers.length > 0 && <Line data={uppers} dataKey="v" type="stepAfter" stroke={AMBER} strokeOpacity={0.4} strokeDasharray="2 4" dot={false} activeDot={false} isAnimationActive={false} name="Upper" />}
          <Line data={values} dataKey="v" type="linear" stroke={BLUE} strokeWidth={2.25} dot={values.length < 40 ? { r: 3.5, fill: BLUE, stroke: '#FBFAF6', strokeWidth: 1.5 } : false} activeDot={{ r: 5 }} isAnimationActive={false} name="Value" />
          <Scatter data={targets} fill={AMBER} shape="diamond" isAnimationActive={false} name="Target" />
          {uppers.length > 0 && <Scatter data={uppers} fill="#FBFAF6" stroke={AMBER} shape="diamond" isAnimationActive={false} name="Upper" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
