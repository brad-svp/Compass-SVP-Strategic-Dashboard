import { useState } from 'react';
import { Check, Loader2, RotateCcw, Users } from 'lucide-react';
import type { Staff } from '@workspace/api-client-react';
import { BrowserDialog } from '@/components/browser-dialog';
import type { SixViewPrefs } from '@/lib/six-view-prefs';

const seg = (on: boolean) => `h-8 rounded-md px-3 text-[12.5px] font-semibold transition-colors ${on ? 'bg-[#0A2540] text-[#FBFAF6]' : 'text-[#0A2540] hover:bg-[#0A2540]/[0.06]'}`;

/** My / All / Custom selection with account-saved state. Viewing is open to everyone. */
export function SixViewControls({ prefs, staff, actor, shown }: { prefs: SixViewPrefs; staff: Staff[]; actor: Staff; shown: Staff[] }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const p = prefs.pref;
  const options = [...(staff.some((s) => s.id === actor.id) ? staff : [actor, ...staff])]
    .sort((a, b) => (a.id === actor.id ? -1 : b.id === actor.id ? 1 : Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)));
  const openCustom = () => { setDraft(p?.mode === 'custom' ? p.staffIds : p?.mode === 'all' ? [] : [actor.id]); setOpen(true); };
  const toggle = (id: string) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  return (
    <div className="mb-4 rounded-2xl border border-card-border bg-card px-4 py-3" data-testid="six-view-controls">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3A4E63]">Showing</span>
        {prefs.isLoading ? <div className="h-8 w-56 animate-pulse rounded-lg bg-[#0A2540]/[0.06]" data-testid="loading-six-view" /> : prefs.isError && !p ? (
          <span className="flex items-center gap-2 text-[13px] text-[#8E2D58]" data-testid="error-six-view">Could not load your view.
            <button type="button" onClick={() => prefs.refetch()} className="font-semibold underline" data-testid="button-retry-six-view">Retry</button></span>
        ) : (
          <div className="inline-flex gap-1 rounded-lg border border-border bg-[#F6F3EC] p-0.5" role="group" aria-label="Whose plans to show">
            <button type="button" className={seg(p?.mode === 'mine')} aria-pressed={p?.mode === 'mine'} onClick={() => prefs.choose({ mode: 'mine', staffIds: [] })} data-testid="button-view-mine">My 6x6</button>
            <button type="button" className={seg(p?.mode === 'all')} aria-pressed={p?.mode === 'all'} onClick={() => prefs.choose({ mode: 'all', staffIds: [] })} data-testid="button-view-all">All teammates</button>
            <button type="button" className={seg(p?.mode === 'custom')} aria-pressed={p?.mode === 'custom'} onClick={openCustom} data-testid="button-view-custom"><Users className="mr-1 inline h-3.5 w-3.5" />Choose people</button>
          </div>
        )}
        <span className="ml-auto text-[12px]" data-testid="status-six-view-save">
          {prefs.save.status === 'saving' && <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving to your account</span>}
          {prefs.save.status === 'saved' && <span className="inline-flex items-center gap-1 text-[#22702A]"><Check className="h-3.5 w-3.5" />Saved to your account</span>}
          {prefs.save.status === 'error' && <span className="inline-flex items-center gap-1.5 text-[#8E2D58]">Not saved: {prefs.save.message}
            <button type="button" onClick={prefs.retry} className="inline-flex items-center gap-0.5 font-semibold underline" data-testid="button-retry-save-view"><RotateCcw className="h-3 w-3" />Retry</button></span>}
        </span>
      </div>
      {p && (
        <div className="mt-2 text-[12.5px] text-[#3A4E63]" data-testid="text-six-view-names">
          {shown.length ? shown.map((s) => (s.id === actor.id ? `${s.name} (you)` : s.name)).join(', ') : 'Nobody selected.'}
        </div>
      )}
      <p className="mt-1 text-[11.5px] text-muted-foreground">Everyone can view all plans. Staff edit their own; admins edit all.</p>

      <BrowserDialog open={open} onOpenChange={setOpen} title="Choose people" description="Pick whose six priorities to show. Saved to your account." testId="dialog-six-view-custom">
        <div className="mb-2 flex gap-3 text-[12.5px] font-semibold">
          <button type="button" className="text-[#1D8BC4]" onClick={() => setDraft(options.filter((s) => s.active).map((s) => s.id))} data-testid="button-select-active">Select all active</button>
          <button type="button" className="text-[#1D8BC4]" onClick={() => setDraft([])} data-testid="button-select-none">Clear</button>
        </div>
        <ul className="max-h-[50dvh] divide-y divide-border/70 overflow-y-auto rounded-lg border border-border bg-card">
          {options.map((s) => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-[13.5px] hover:bg-[#0A2540]/[0.03]">
                <input type="checkbox" checked={draft.includes(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-[#1D8BC4]" data-testid={`checkbox-person-${s.id}`} />
                <span className="flex-1 text-[#0A2540]">{s.name}{s.id === actor.id ? ' (you)' : ''}</span>
                {!s.active && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">inactive</span>}
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-[12px] text-muted-foreground">{draft.length} selected</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg px-3 text-[13px] font-semibold text-[#0A2540]">Cancel</button>
            <button type="button" onClick={() => { prefs.choose({ mode: 'custom', staffIds: draft }); setOpen(false); }}
              className="h-9 rounded-lg bg-[#0A2540] px-4 text-[13px] font-semibold text-[#FBFAF6]" data-testid="button-apply-custom">Show selected</button>
          </div>
        </div>
      </BrowserDialog>
    </div>
  );
}

export function EmptySelection() {
  return (
    <div className="rounded-xl border border-dashed border-[#1D8BC4]/40 bg-[#1D8BC4]/[0.05] p-4 text-[13px] text-[#3A4E63]" data-testid="empty-six-selection">
      No people selected. Use <span className="font-semibold">Choose people</span>, or switch to My 6x6 or All teammates.
    </div>
  );
}
