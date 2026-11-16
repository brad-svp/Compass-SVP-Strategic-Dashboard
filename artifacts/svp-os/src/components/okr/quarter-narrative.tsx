import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Compass, Pencil, Plus, RotateCw } from 'lucide-react';
import {
  getGetQuarterNarrativeQueryKey, getQuarterNarrative, useGetQuarterNarrative, useSaveQuarterNarrative, type QuarterNarrative,
} from '@workspace/api-client-react';
import { BrowserDialog } from '@/components/browser-dialog';
import { Btn, FormError, inputCls } from '@/components/six-by-six/form-kit';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, errorStatus, fmtDate } from '@/lib/format';
import type { Quarter } from '@/lib/qbo';
import { cn } from '@/lib/utils';

const MAX = 12000;

/** Optional admin-written direction for a quarter, shown above its QBOs. */
export function QuarterNarrativePanel({ cycleId, quarter, cycleName, compact = false, className }: {
  cycleId: string; quarter: Quarter; cycleName?: string; compact?: boolean; className?: string;
}) {
  const q = useGetQuarterNarrative(cycleId, quarter, { query: { enabled: !!cycleId, queryKey: getGetQuarterNarrativeQueryKey(cycleId, quarter) } });
  const [editing, setEditing] = useState<{ version: number; draft: string; nonce: number } | null>(null);

  if (!cycleId) return null;
  if (q.isLoading) return <div className={cn('h-16 animate-pulse rounded-xl bg-[#0A2540]/[0.04]', className)} data-testid="skeleton-quarter-narrative" />;
  if (q.isError || !q.data) {
    return (
      <div role="alert" className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#B03E71]/30 bg-[#B03E71]/[0.05] px-4 py-3 text-[13px] text-[#8E2D58]', className)} data-testid="error-quarter-narrative">
        <span>Could not load the {quarter} direction. {errorMessage(q.error)}</span>
        <button type="button" onClick={() => q.refetch()} className="inline-flex items-center gap-1 font-semibold hover:underline" data-testid="button-retry-quarter-narrative"><RotateCw className="h-3.5 w-3.5" />Retry</button>
      </div>
    );
  }
  const n = q.data;
  const text = n.narrative.trim();
  const open = () => setEditing({ version: n.version, draft: n.narrative, nonce: 0 });

  if (!text && !n.canEdit) return null;

  return (
    <>
      {!text ? (
        <button type="button" onClick={open}
          className={cn('flex w-full items-center gap-2 rounded-xl border border-dashed border-[#ECA519]/60 bg-[#ECA519]/[0.05] px-4 py-2.5 text-left text-[13px] font-semibold text-[#72500A] hover:bg-[#ECA519]/10', className)}
          data-testid="button-add-quarter-narrative">
          <Plus className="h-4 w-4" /> Add a {quarter} narrative <span className="font-normal text-muted-foreground">Optional. Sets the tone above the QBOs.</span>
        </button>
      ) : (
        <section className={cn('relative rounded-xl border-l-[3px] border-[#ECA519] bg-[#F6F3EC] py-3 pl-4 pr-3', className)} data-testid="panel-quarter-narrative">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#8A5A00]">
              <Compass className="h-3.5 w-3.5" /> {cycleName ? `${cycleName} · ` : ''}{quarter} direction
            </div>
            {n.canEdit && (
              <button type="button" onClick={open} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-[#0A2540] hover:bg-[#0A2540]/[0.06]" data-testid="button-edit-quarter-narrative">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            )}
          </div>
          <p className={cn('whitespace-pre-wrap leading-relaxed text-[#1E3349]', compact ? 'line-clamp-4 text-[13px]' : 'text-[14.5px]')} data-testid="text-quarter-narrative">{n.narrative}</p>
          {n.updatedAt && !compact && <div className="mt-2 text-[11px] text-muted-foreground" data-testid="text-quarter-narrative-updated">Updated {fmtDate(n.updatedAt)}</div>}
        </section>
      )}
      <BrowserDialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }} testId="dialog-quarter-narrative"
        title={`${quarter} narrative`} description="Plain text shown to everyone above this quarter's QBOs. Leave empty to clear it.">
        {editing && <NarrativeForm key={editing.nonce} cycleId={cycleId} quarter={quarter} initial={editing}
          onClose={() => setEditing(null)} onReload={(latest, draft) => setEditing({ version: latest.version, draft, nonce: editing.nonce + 1 })} />}
      </BrowserDialog>
    </>
  );
}

function NarrativeForm({ cycleId, quarter, initial, onClose, onReload }: {
  cycleId: string; quarter: Quarter; initial: { version: number; draft: string };
  onClose: () => void; onReload: (latest: QuarterNarrative, draft: string) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const save = useSaveQuarterNarrative();
  const [version] = useState(initial.version);
  const [draft, setDraft] = useState(initial.draft);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<QuarterNarrative | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [reloading, setReloading] = useState(false);
  const key = getGetQuarterNarrativeQueryKey(cycleId, quarter);

  async function persist(narrative: string) {
    setError(null);
    try {
      await save.mutateAsync({ cycleId, quarter, data: { narrative, expectedVersion: version } });
      await qc.invalidateQueries({ queryKey: key });
      toast({ title: narrative.trim() ? `${quarter} narrative saved` : `${quarter} narrative cleared` });
      onClose();
    } catch (e) {
      setConfirmClear(false);
      if (errorStatus(e) === 409) {
        await qc.invalidateQueries({ queryKey: key });
        try { setConflict(await getQuarterNarrative(cycleId, quarter)); } catch { setConflict({ cycleId, quarter, narrative: '', version, canEdit: true, updatedAt: null }); }
      } else setError(errorMessage(e));
    }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); if (!conflict) persist(draft); };

  async function reload() {
    setReloading(true);
    try { onReload(await getQuarterNarrative(cycleId, quarter), draft); }
    catch (e) { setError(errorMessage(e)); }
    finally { setReloading(false); }
  }

  const busy = save.isPending;
  return (
    <form onSubmit={submit} className="space-y-4" data-testid="form-quarter-narrative">
      {conflict && (
        <div role="alert" className="space-y-2 rounded-lg border border-[#ECA519]/50 bg-[#ECA519]/10 px-3 py-2.5 text-sm text-[#6B4600]" data-testid="notice-narrative-conflict">
          <p>Someone saved a newer version. Your draft is kept below. Load the latest version number to save your draft over it.</p>
          {conflict.narrative && <p className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-md bg-card/70 px-2 py-1.5 text-[12.5px] text-[#3A4E63]" data-testid="text-narrative-latest">{conflict.narrative}</p>}
          <button type="button" onClick={reload} disabled={reloading} className="inline-flex items-center gap-1.5 rounded-md bg-[#0A2540] px-3 py-1.5 text-[13px] font-semibold text-[#FBFAF6] disabled:opacity-50" data-testid="button-narrative-reload">
            <RotateCw className="h-3.5 w-3.5" /> {reloading ? 'Loading' : 'Keep my draft, load latest'}
          </button>
        </div>
      )}
      <div className="space-y-1.5">
        <textarea className={`${inputCls} min-h-[180px] leading-relaxed`} value={draft} maxLength={MAX} autoFocus onChange={(e) => setDraft(e.target.value)}
          placeholder={`What matters most in ${quarter}, and why.`} aria-label={`${quarter} narrative`} data-testid="input-quarter-narrative" />
        <div className="flex justify-end font-mono text-[11px] text-muted-foreground" data-testid="text-narrative-count">{draft.length.toLocaleString()} / {MAX.toLocaleString()}</div>
      </div>
      <FormError message={error} />
      {confirmClear ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#B03E71]/30 bg-[#B03E71]/[0.05] px-3 py-2.5" data-testid="confirm-clear-narrative">
          <span className="text-sm text-[#8E2D58]">Clear the {quarter} narrative for everyone?</span>
          <div className="flex gap-2">
            <Btn tone="ghost" type="button" onClick={() => setConfirmClear(false)} disabled={busy}>Keep</Btn>
            <Btn tone="danger" type="button" onClick={() => persist('')} disabled={busy} data-testid="button-confirm-clear-narrative">{busy ? 'Clearing' : 'Clear'}</Btn>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {initial.draft.trim() ? (
            <button type="button" onClick={() => setConfirmClear(true)} disabled={busy || !!conflict} className="text-[13px] font-semibold text-[#8E2D58] hover:underline disabled:opacity-50" data-testid="button-clear-narrative">Clear narrative</button>
          ) : <span />}
          <div className="flex gap-2">
            <Btn tone="ghost" type="button" onClick={onClose}>Cancel</Btn>
            <Btn type="submit" disabled={busy || !!conflict} data-testid="button-save-narrative">{busy ? 'Saving' : 'Save'}</Btn>
          </div>
        </div>
      )}
    </form>
  );
}
