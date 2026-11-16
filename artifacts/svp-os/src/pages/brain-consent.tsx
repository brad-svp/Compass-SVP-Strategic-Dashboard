import { useState } from 'react';
import { useSearch } from 'wouter';
import { useGetBrainConsent, getGetBrainConsentQueryKey, useDecideBrainConsent } from '@workspace/api-client-react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorPanel } from '@/components/ui-bits';
import { EmptyState } from '@/components/brain/brain-bits';
import { useStaffSession } from '@/lib/session-context';
import { errorMessage, errorStatus, fmtDate } from '@/lib/format';
import { useBrainToastError } from '@/lib/brain';

const SCOPE_TEXT: Record<string, string> = {
  'brain:read': 'Search and read Brain entries you can see',
  'operations:read': 'Read SVP operating data, including calendar, QBOs and personal 6x6s; no operational changes',
  'brain:write': 'Add contributions as you (marked Unreviewed)',
};

export default function BrainConsentPage() {
  const requestId = new URLSearchParams(useSearch()).get('request') ?? '';
  const me = useStaffSession();
  const q = useGetBrainConsent(requestId, { query: { queryKey: getGetBrainConsentQueryKey(requestId), enabled: !!requestId, retry: false } });
  const decide = useDecideBrainConsent();
  const fail = useBrainToastError();
  const [choice, setChoice] = useState<boolean | null>(null);

  function submit(allow: boolean) {
    setChoice(allow);
    decide.mutate({ id: requestId, data: { allow } }, {
      onSuccess: (r) => { window.location.assign(r.redirectUrl); },
      onError: (e) => { setChoice(null); fail(e, allow ? 'Could not grant access' : 'Could not deny'); },
    });
  }

  let body;
  if (!requestId) body = <EmptyState testId="empty-brain-consent" title="No authorization request." body="Start the connection from Claude. It will bring you back here." />;
  else if (q.isLoading) body = <Skeleton className="h-72 rounded-2xl bg-[#0A2540]/6" data-testid="loading-brain-consent" />;
  else if (q.isError) {
    const s = errorStatus(q.error);
    body = s === 404 || s === 410
      ? <EmptyState testId="empty-brain-consent-expired" title="This request has expired." body="Return to Claude and start the connection again." />
      : <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  } else if (q.data) {
    const c = q.data;
    let host = c.redirectUri;
    try { host = new URL(c.redirectUri).host; } catch { /* keep raw */ }
    body = (
      <section className="rounded-2xl border border-card-border bg-card p-6 md:p-8" data-testid="panel-brain-consent">
        <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-[#0A2540]"><ShieldCheck className="h-5 w-5 text-[#5FB6E3]" /></div>
        <h1 className="font-display text-2xl font-semibold text-[#0A2540]"><span data-testid="text-consent-client">{c.clientName}</span> wants to access the Brain as you.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Signed in as <span className="font-semibold text-[#0A2540]">{me.name}</span>. Access is limited to what you can already see.</p>
        <h2 className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3A4E63]">It will be able to</h2>
        <ul className="mt-2 space-y-1.5">
          {c.scopes.map((s) => <li key={s} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm" data-testid={`text-consent-scope-${s}`}>
            <code className="shrink-0 rounded bg-[#1D8BC4]/10 px-1.5 font-mono text-[11px]">{s}</code><span>{SCOPE_TEXT[s] ?? s}</span></li>)}
        </ul>
        <dl className="mt-4 space-y-1 font-mono text-[11px] text-muted-foreground">
          <div>returns to <span className="text-[#0A2540]">{host}</span></div>
          {c.resource && <div>resource {c.resource}</div>}
          <div>request expires {fmtDate(c.expiresAt, 'MMM d, h:mm a')}</div>
        </dl>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={decide.isPending} onClick={() => submit(false)} data-testid="button-consent-deny">{decide.isPending && choice === false ? 'Denying...' : 'Deny'}</Button>
          <Button disabled={decide.isPending} onClick={() => submit(true)} data-testid="button-consent-allow">{decide.isPending && choice === true ? 'Granting...' : 'Grant access'}</Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">You can revoke this anytime from Brain, then Claude connections.</p>
      </section>
    );
  }
  return <div className="mx-auto max-w-xl py-4">{body}</div>;
}
