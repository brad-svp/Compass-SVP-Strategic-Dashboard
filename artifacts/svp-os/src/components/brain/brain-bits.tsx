import type { BrainEntry } from '@workspace/api-client-react';
import { AlertTriangle, Archive, CheckCircle2, CircleDashed, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { kindLabel } from '@/lib/brain';

export function ReviewBadge({ status, overdue, testId }: { status: string; overdue?: boolean; testId?: string }) {
  const reviewed = status === 'reviewed';
  return (
    <span data-testid={testId} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
      reviewed ? 'bg-[#22702A]/10 text-[#22702A] ring-[#22702A]/25' : 'bg-[#ECA519]/15 text-[#72500A] ring-[#ECA519]/40')}>
      {reviewed ? <CheckCircle2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
      {reviewed ? 'Reviewed' : 'Unreviewed'}
      {overdue && <span className="ml-0.5 inline-flex items-center gap-0.5 text-[#B03E71]"><Clock className="h-3 w-3" />due</span>}
    </span>
  );
}

export function EntryFlags({ entry }: { entry: Pick<BrainEntry, 'conflict' | 'retired' | 'mergedIntoId' | 'kind'> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="rounded bg-[#0A2540]/[0.06] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#3A4E63]">{kindLabel(entry.kind)}</span>
      {entry.conflict && <span className="inline-flex items-center gap-1 rounded bg-[#B03E71]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#8C2F59]"><AlertTriangle className="h-3 w-3" />Conflict</span>}
      {entry.retired && <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"><Archive className="h-3 w-3" />{entry.mergedIntoId ? 'Merged' : 'Retired'}</span>}
    </span>
  );
}

export function EmptyState({ title, body, children, testId }: { title: string; body: string; children?: React.ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="rounded-2xl border border-dashed border-[#0A2540]/20 bg-card/60 px-6 py-12 text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-[#1D8BC4]/10"><CircleDashed className="h-5 w-5 text-[#1D8BC4]" /></div>
      <div className="font-display text-xl text-[#0A2540]">{title}</div>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}
