import type { Staff, ScorecardRevision } from '@workspace/api-client-react';
import { fmtValue, goalLabel } from '@/lib/scorecard';
import { fmtDate } from '@/lib/format';

export function EntryHistory({ revisions, staff, decimals }: { revisions: ScorecardRevision[]; staff: Staff[]; decimals: number }) {
  if (revisions.length === 0) {
    return <p className="text-[12px] text-muted-foreground" data-testid="text-history-empty">No history yet for this week.</p>;
  }
  return (
    <ol className="relative space-y-3 border-l border-[#0A2540]/12 pl-4" data-testid="list-entry-history">
      {revisions.map((r) => {
        const who = staff.find((s) => s.id === r.authorId)?.name ?? 'Former staff';
        return (
          <li key={r.id} className="relative text-[13px]" data-testid={`revision-${r.id}`}>
            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#1D8BC4]" />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-[11px] text-[#1D8BC4]">v{r.version}</span>
              <span className="font-mono font-medium text-[#0A2540]">{r.value == null ? 'Cleared' : fmtValue(r.value, decimals, r.unit)}</span>
              <span className="text-[11px] text-muted-foreground">{who} · {fmtDate(r.createdAt, 'MMM d, h:mm a')}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">Goal at the time: {goalLabel(r, decimals)}</div>
            {r.reason && <div className="mt-0.5 text-[12px] text-[#8A5A00]">Reason: {r.reason}</div>}
            {r.note && <div className="mt-0.5 whitespace-pre-wrap text-[12px] text-[#1E3349]">{r.note}</div>}
          </li>
        );
      })}
    </ol>
  );
}
