import { useState } from 'react';
import { AlertTriangle, Copy, ExternalLink, KeyRound } from 'lucide-react';
import { BrowserDialog } from '@/components/browser-dialog';
import { Btn } from '@/components/six-by-six/form-kit';
import { useToast } from '@/hooks/use-toast';
import type { CalendarActions } from '@/lib/calendar-hooks';

const GOOGLE_HELP = 'https://support.google.com/calendar/answer/37100';

export function SubscribeDialog({ open, onClose, hasSubscription, isPublished, actions }: {
  open: boolean; onClose: () => void; hasSubscription: boolean; isPublished: boolean; actions: CalendarActions;
}) {
  // The private link lives only in this component's memory; it is never logged or persisted.
  const [link, setLink] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'replace' | 'revoke' | null>(null);
  const { toast } = useToast();
  const close = () => { setLink(null); setConfirm(null); onClose(); };

  async function create() {
    setConfirm(null);
    const path = await actions.createSubscription();
    if (path) setLink(new URL(path, window.location.origin).toString());
  }
  async function revoke() {
    setConfirm(null);
    const r = await actions.revokeSubscription();
    if (r.ok) setLink(null);
  }
  async function copy() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); toast({ title: 'Link copied' }); }
    catch { toast({ title: 'Copy blocked', description: 'Select the link and copy it manually.', variant: 'destructive' }); }
  }

  return (
    <BrowserDialog open={open} onOpenChange={(o) => { if (!o) close(); }} title="Subscribe in Google Calendar"
      description="A private, read-only feed of the whole SVP master calendar.">
      <div className="space-y-4 text-sm text-[#3A4E63]" data-testid="dialog-subscribe">
        {!isPublished && (
          <p className="flex gap-2 rounded-lg border border-[#ECA519]/50 bg-[#ECA519]/10 px-3 py-2.5 text-[13px] text-[#6B4600]" data-testid="notice-unpublished">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This app is not published yet. Google can only fetch a stable, public HTTPS address, so publish first and create the link from the published site. A link made here is for testing only.
          </p>
        )}
        <ol className="list-decimal space-y-1 pl-5">
          <li>Create your private link below and copy it.</li>
          <li>In Google Calendar on the web, open Settings, then Add calendar, then From URL.</li>
          <li>Paste the HTTPS link and choose Add calendar.</li>
        </ol>
        <ul className="space-y-1 text-[13px]">
          <li>The feed includes every program and year, not just the filters on screen.</li>
          <li>It is one-way and read-only. Google decides when to refresh, often hours later, so changes are not instant.</li>
          <li>Treat the link like a password: anyone holding it can read the calendar. It stops working if you are deactivated.</li>
        </ul>

        {link ? (
          <div className="space-y-2 rounded-xl border border-[#0A2540]/15 bg-card p-3" data-testid="panel-feed-link">
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#0A2540]" htmlFor="feed-link">Your private feed link</label>
            <div className="flex gap-2">
              <input id="feed-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-[#F6F3EC] px-2 font-mono text-[12px] text-[#0A2540]" data-testid="input-feed-link" />
              <Btn type="button" onClick={copy} data-testid="button-copy-feed"><Copy className="h-3.5 w-3.5" /> Copy</Btn>
            </div>
            <p className="text-[12px] text-[#8E2D58]">Shown once. If you lose it you will need to create a replacement, which breaks the old link.</p>
          </div>
        ) : hasSubscription ? (
          <p className="flex items-center gap-2 rounded-lg bg-[#0A2540]/[0.04] px-3 py-2 text-[13px]" data-testid="text-has-subscription">
            <KeyRound className="h-4 w-4 text-[#1D8BC4]" /> You already have an active feed link. For safety it cannot be shown again.
          </p>
        ) : null}

        {confirm && (
          <div className="space-y-2 rounded-lg border border-[#B03E71]/30 bg-[#B03E71]/[0.05] px-3 py-2.5 text-[13px] text-[#8E2D58]" data-testid={`confirm-${confirm}`}>
            <p>{confirm === 'replace' ? 'Replace your link? The old link stops working, so update Google with the new one.' : 'Revoke your link? Google stops receiving updates; events it already cached may stay until you remove the calendar there.'}</p>
            <div className="flex justify-end gap-2">
              <Btn tone="ghost" type="button" onClick={() => setConfirm(null)}>Keep current</Btn>
              <Btn tone="danger" type="button" disabled={actions.subPending} onClick={confirm === 'replace' ? create : revoke} data-testid={`button-confirm-${confirm}`}>
                {confirm === 'replace' ? 'Replace link' : 'Revoke link'}
              </Btn>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <a href={GOOGLE_HELP} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#125F88] hover:underline" data-testid="link-google-help">
            Google's instructions <ExternalLink className="h-3 w-3" />
          </a>
          <div className="flex flex-wrap gap-2">
            {hasSubscription && !confirm && <Btn tone="ghost" type="button" onClick={() => setConfirm('revoke')} disabled={actions.subPending} data-testid="button-revoke-feed">Revoke</Btn>}
            {!link && !confirm && (hasSubscription
              ? <Btn type="button" onClick={() => setConfirm('replace')} disabled={actions.subPending} data-testid="button-replace-feed">Replace link</Btn>
              : <Btn type="button" onClick={create} disabled={actions.subPending} data-testid="button-create-feed">{actions.subPending ? 'Creating' : 'Create private link'}</Btn>)}
            {link && <Btn tone="ghost" type="button" onClick={close}>Done</Btn>}
          </div>
        </div>
      </div>
    </BrowserDialog>
  );
}
