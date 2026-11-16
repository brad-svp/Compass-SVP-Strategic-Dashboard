import { useState } from 'react';
import { useGetCalendarHistory } from '@workspace/api-client-react';
import { BrowserDialog } from '@/components/browser-dialog';
import { errorMessage } from '@/lib/format';

const time = (value: string) => new Date(value).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' });
const actionLabel = (action: string) => ({ create: 'Created', update: 'Updated', remove: 'Removed', seed: 'Imported' }[action] ?? action);

export function CalendarChangeHistory({ open, onClose, eventId }: { open: boolean; onClose: () => void; eventId?: string }) {
  const [offset, setOffset] = useState(0);
  const query = useGetCalendarHistory({ eventId, offset }, { query: { enabled: open, refetchOnMount: 'always', refetchInterval: open ? 30_000 : false } });
  return (
    <BrowserDialog open={open} onOpenChange={value => { if (!value) { setOffset(0); onClose(); } }}
      title="Calendar change log" description="Who changed what and when. Times are Sacramento (Pacific). Removed entries remain in this history." testId="dialog-calendar-history">
      {query.isLoading ? <p className="text-sm text-muted-foreground">Loading history…</p>
        : query.isError ? <div role="alert" className="text-sm text-[#8E2D58]">{errorMessage(query.error)} <button type="button" onClick={() => query.refetch()} className="underline">Retry</button></div>
          : <>
            {!query.data?.entries.length && <p className="text-sm text-muted-foreground">No changes recorded yet.</p>}
            <ol className="space-y-4" data-testid="list-calendar-history">
              {query.data?.entries.map(entry => (
                <li key={entry.id} className="rounded-lg border border-border bg-card p-3" data-testid={`calendar-change-${entry.id}`}>
                  <p className="font-semibold text-[#0A2540]">{entry.title}</p>
                  <p className="mb-2 text-xs text-muted-foreground">{actionLabel(entry.action)} by <strong>{entry.actorName}</strong> · {time(entry.at)} PT</p>
                  <dl className="space-y-2 text-[13px]">
                    {entry.changes.map(change => (
                      <div key={change.field} className="border-t border-border/60 pt-2">
                        <dt className="font-semibold text-[#3A4E63]">{change.field}</dt>
                        <dd className="whitespace-pre-wrap break-words">
                          <span className="text-muted-foreground">{change.before ?? 'Not set'}</span>
                          <span aria-label="changed to" className="mx-2">→</span>
                          <span className="text-[#0A2540]">{change.after ?? 'Not set'}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex justify-between gap-3">
              <button type="button" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))} className="rounded border px-3 py-2 text-sm disabled:opacity-40">Newer changes</button>
              <button type="button" disabled={!query.data?.hasMore} onClick={() => setOffset(offset + 50)} className="rounded border px-3 py-2 text-sm disabled:opacity-40">Older changes</button>
            </div>
          </>}
    </BrowserDialog>
  );
}
