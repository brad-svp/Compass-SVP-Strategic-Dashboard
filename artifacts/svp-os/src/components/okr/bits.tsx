import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { CheckIn } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { HEALTH } from '@/lib/okr';
import { fmtDate } from '@/lib/format';

export function HealthDot({ health, className }: { health: string; className?: string }) {
  const h = HEALTH[health] ?? HEALTH.none;
  return (
    <span title={h.label} className={cn('relative inline-flex h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ background: h.color }} data-testid={`health-${health}`}>
      {health === 'red' && <span className="absolute inset-0 animate-ping rounded-full opacity-40" style={{ background: h.color }} />}
    </span>
  );
}

export function HealthLabel({ health }: { health: string }) {
  const h = HEALTH[health] ?? HEALTH.none;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: health === 'none' ? '#5A6B7D' : h.color }}>
      <HealthDot health={health} /> {h.label}
    </span>
  );
}

/** Progress bar with an expected-pace tick. `measured=false` renders an honest empty track. */
export function ProgressTrack({ value, expected, health, measured = true, className }: { value: number; expected?: number; health: string; measured?: boolean; className?: string }) {
  const color = (HEALTH[health] ?? HEALTH.none).color;
  return (
    <div className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-[#0A2540]/8', className)}>
      {measured && (
        <div className="absolute inset-y-0 left-0 w-full origin-left rounded-full transition-transform duration-700 ease-out"
          style={{ transform: `scaleX(${Math.max(0, Math.min(100, value)) / 100})`, background: color }} />
      )}
      {measured && expected != null && (
        <div className="absolute inset-y-[-2px] w-[2px] bg-[#0A2540]/55" style={{ left: `calc(${Math.max(0, Math.min(100, expected))}% - 1px)` }} title={`Expected pace ${Math.round(expected)}%`} />
      )}
    </div>
  );
}

export const STATUS_TONE: Record<string, string> = {
  draft: 'bg-[#ECA519]/12 text-[#8A5A00] ring-[#ECA519]/40',
  active: 'bg-[#49B949]/12 text-[#22702A] ring-[#49B949]/40',
  closed: 'bg-[#0A2540]/8 text-[#3A4E63] ring-[#0A2540]/20',
};

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-medium ring-1 ring-inset', className)}>{children}</span>;
}

export function ScopeChip({ scope }: { scope: string }) {
  return <Chip className="bg-[#1D8BC4]/8 uppercase text-[#125F88] ring-[#1D8BC4]/25">{scope}</Chip>;
}
export function StatusChip({ status }: { status: string }) {
  return <Chip className={cn('capitalize', STATUS_TONE[status])}>{status}</Chip>;
}

/** Small SVG sparkline built only from recorded check-in progress snapshots. */
export function Sparkline({ checkIns, width = 96, height = 28 }: { checkIns: CheckIn[]; width?: number; height?: number }) {
  const pts = [...checkIns].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (pts.length === 0) return <span className="font-mono text-[10px] text-muted-foreground" data-testid="sparkline-empty">no history</span>;
  const pad = 3;
  const startTime = Date.parse(pts[0].createdAt);
  const duration = Date.parse(pts[pts.length - 1].createdAt) - startTime;
  const x = (i: number) => (duration <= 0 ? width / 2 : pad + ((Date.parse(pts[i].createdAt) - startTime) / duration) * (width - pad * 2));
  const y = (p: number) => height - pad - (Math.max(0, Math.min(100, p)) / 100) * (height - pad * 2);
  const d = pts.map((c, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(c.progress).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible" data-testid="sparkline" role="img"
      aria-label={`Progress history, ${pts.length} check-in${pts.length === 1 ? '' : 's'}: ${pts.map((c) => `${fmtDate(c.createdAt, 'MMM d')} ${Math.round(c.progress)}% ${c.measurementType === 'confidence' ? 'confidence' : 'metric'}`).join(', ')}`}>
      <title>{`Progress from ${pts.length} recorded check-ins`}</title>
      <line x1={0} x2={width} y1={y(100)} y2={y(100)} stroke="#0A2540" strokeOpacity={0.08} strokeDasharray="2 3" />
      {pts.length > 1 && <path d={d} fill="none" stroke="#1D8BC4" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />}
      {pts.map((c, i) => (
        <circle key={c.id} cx={x(i)} cy={y(c.progress)} r={i === pts.length - 1 ? 2.8 : 1.8}
          fill={c.measurementType === 'confidence' ? '#F6F3EC' : '#1D8BC4'} stroke="#1D8BC4" strokeWidth={1.2}>
          <title>{`${fmtDate(c.createdAt, 'MMM d')} · ${Math.round(c.progress)}% · ${c.measurementType === 'confidence' ? `confidence ${c.confidence ?? ''}%` : `value ${c.value ?? ''}`}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Click-to-edit text. Enter (or blur) saves, Escape cancels. */
export function InlineText({ value, onSave, canEdit, multiline, placeholder, className, testId }: {
  value: string; onSave: (v: string) => Promise<unknown>; canEdit: boolean; multiline?: boolean; placeholder?: string; className?: string; testId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (!canEdit) {
    return value ? <div className={cn('whitespace-pre-wrap', className)} data-testid={testId}>{value}</div> : null;
  }
  const commit = async () => {
    const v = draft.trim();
    setEditing(false);
    if (!multiline && !v) { setDraft(value); return; }
    if (v !== value.trim()) await onSave(v);
  };
  if (editing) {
    const common = {
      ref, value: draft, 'data-testid': `${testId}-input`,
      onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); void commit(); }
      },
      className: cn('w-full rounded-md border border-[#1D8BC4]/50 bg-white/80 px-2 py-1 outline-none ring-2 ring-[#1D8BC4]/15', className),
    };
    return multiline ? <textarea rows={3} {...common} /> : <input {...common} />;
  }
  return (
    <button type="button" onClick={() => setEditing(true)} data-testid={testId}
      className={cn('group -mx-1 flex w-full items-start gap-2 rounded-md px-1 text-left transition-colors hover:bg-[#1D8BC4]/[0.06]', className)}>
      <span className={cn('flex-1 whitespace-pre-wrap', !value && 'italic text-muted-foreground')}>{value || placeholder}</span>
      <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-[#1D8BC4] opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
