import { useState } from 'react';
import { Check, MessageSquarePlus } from 'lucide-react';
import type { ScorecardMetric } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import type { TrackerActions } from '@/lib/scorecard-tracker-hooks';

/** One box per metric. Every save appends a new immutable entry; nothing is overwritten. */
export function LatestValueBox({ metric, actions }: { metric: ScorecardMetric; actions: TrackerActions }) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const n = value.trim() === '' ? NaN : Number(value);
  const ok = Number.isFinite(n);

  if (!metric.canRecord) {
    return <p className="text-[12px] text-muted-foreground" data-testid={`text-cannot-record-${metric.id}`}>{metric.active ? 'Only the owner or an admin records this.' : 'Archived. Restore to record.'}</p>;
  }
  const save = async () => {
    if (!ok || busy) return;
    setBusy(true);
    const r = await actions.record(metric.id, n, note.trim());
    setBusy(false);
    if (r.ok) { setValue(''); setNote(''); setShowNote(false); }
  };
  return (
    <form className="w-full space-y-1.5" onSubmit={(e) => { e.preventDefault(); void save(); }} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-stretch overflow-hidden rounded-lg border border-[#0A2540]/15 bg-white/70 focus-within:border-[#1D8BC4] focus-within:ring-2 focus-within:ring-[#1D8BC4]/20">
        <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Latest value"
          aria-label={`Latest value for ${metric.title}`} className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-[15px] text-[#0A2540] outline-none placeholder:font-sans placeholder:text-[13px] placeholder:text-[#3A4E63]/60"
          data-testid={`input-latest-${metric.id}`} />
        {metric.unit && <span className="flex items-center pr-2 text-[11px] text-[#3A4E63]">{metric.unit}</span>}
        <button type="button" onClick={() => setShowNote((s) => !s)} aria-label="Add note" title="Add a note"
          className={`border-l border-[#0A2540]/10 px-2.5 ${showNote ? 'bg-[#1D8BC4]/10 text-[#1D8BC4]' : 'text-[#3A4E63] hover:bg-[#0A2540]/5'}`} data-testid={`button-note-toggle-${metric.id}`}>
          <MessageSquarePlus className="h-4 w-4" />
        </button>
        <Button type="submit" disabled={!ok || busy} className="h-auto rounded-none bg-[#0A2540] px-3.5 text-white hover:bg-[#0A2540]/90" data-testid={`button-record-${metric.id}`}>
          <Check className="mr-1 h-4 w-4" />{busy ? 'Saving' : 'Save'}
        </Button>
      </div>
      {showNote && (
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} placeholder="Optional note: source, context, caveat"
          className="w-full rounded-md border border-[#0A2540]/12 bg-white/70 px-3 py-1.5 text-[13px] outline-none focus:border-[#1D8BC4]" data-testid={`input-note-${metric.id}`} />
      )}
      {value.trim() !== '' && !ok && <p className="text-[11px] text-[#8E2D58]">Enter a number. Zero counts.</p>}
    </form>
  );
}
