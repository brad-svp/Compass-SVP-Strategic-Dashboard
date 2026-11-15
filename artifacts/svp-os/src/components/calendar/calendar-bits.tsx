import { Search } from 'lucide-react';
import type { CalendarEvent } from '@workspace/api-client-react';
import { NativeSelect } from '@/components/native-select';
import { DATE_STATUS, programColor, type Filters } from '@/lib/calendar';

export function DateStatusBadge({ status }: { status: string }) {
  const s = DATE_STATUS[status] ?? DATE_STATUS.tbd;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${s.cls}`} data-testid={`badge-date-${status}`}>{s.label}</span>;
}

export function ProgramTag({ program }: { program: string }) {
  if (!program) return <span className="text-[12px] text-muted-foreground">No program</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0A2540]">
      <span className="h-2 w-2 rounded-sm" style={{ background: programColor(program) }} />{program}
    </span>
  );
}

/** Visual style for an event block: solid for confirmed, hatched/outlined for tentative, struck for cancelled. */
export function eventStyle(e: CalendarEvent) {
  const c = programColor(e.program);
  if (e.dateStatus === 'confirmed') return { background: c, color: '#FBFAF6', borderColor: c };
  if (e.dateStatus === 'cancelled') return { background: 'transparent', color: '#8E2D58', borderColor: '#B03E7155', textDecoration: 'line-through' };
  return { background: `repeating-linear-gradient(135deg, ${c}1f 0 6px, ${c}0d 6px 12px)`, color: '#0A2540', borderColor: `${c}99`, borderStyle: 'dashed' };
}

export function FiltersBar({ value, onChange, programs, audiences }: {
  value: Filters; onChange: (f: Filters) => void; programs: string[]; audiences: string[];
}) {
  const active = value.program || value.dateStatus || value.audience || value.q;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="calendar-filters">
      <label className="relative min-w-[12rem] flex-1 sm:max-w-xs">
        <span className="sr-only">Search events</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3A4E63]" />
        <input type="search" value={value.q} onChange={(e) => onChange({ ...value, q: e.target.value })} placeholder="Search title, place, notes"
          className="h-9 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-[13px] text-[#0A2540] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D8BC4]/40" data-testid="input-calendar-search" />
      </label>
      <NativeSelect aria-label="Program" wrapClassName="w-40" value={value.program} onChange={(e) => onChange({ ...value, program: e.target.value })} data-testid="select-filter-program">
        <option value="">All programs</option>
        {programs.map((p) => <option key={p} value={p}>{p}</option>)}
      </NativeSelect>
      <NativeSelect aria-label="Date status" wrapClassName="w-36" value={value.dateStatus} onChange={(e) => onChange({ ...value, dateStatus: e.target.value })} data-testid="select-filter-status">
        <option value="">Any status</option>
        {Object.entries(DATE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </NativeSelect>
      <NativeSelect aria-label="Audience" wrapClassName="w-40" value={value.audience} onChange={(e) => onChange({ ...value, audience: e.target.value })} data-testid="select-filter-audience">
        <option value="">Any audience</option>
        {audiences.map((a) => <option key={a} value={a}>{a}</option>)}
      </NativeSelect>
      {active && (
        <button type="button" onClick={() => onChange({ program: '', dateStatus: '', audience: '', q: '' })}
          className="h-9 px-2 text-[13px] font-semibold text-[#125F88] hover:underline" data-testid="button-clear-filters">Clear</button>
      )}
    </div>
  );
}
