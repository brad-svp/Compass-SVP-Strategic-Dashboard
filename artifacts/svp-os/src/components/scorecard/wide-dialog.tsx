import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { ModalSurface } from '../modal-surface';

/** Wide popup detail with room for a chart and history ledger. */
export function WideDialog({ open, onOpenChange, title, eyebrow, children, testId }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; eyebrow: ReactNode; children: ReactNode; testId: string;
}) {
  const titleId = useId();
  return (
    <ModalSurface open={open} onClose={() => onOpenChange(false)} labelledBy={titleId}
      className="relative max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-[#FBFAF6] text-foreground shadow-2xl outline-none"
      testId={testId}>
      <header className="flex items-start justify-between gap-6 border-b border-[#0A2540]/10 px-6 pb-4 pt-5">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#1D8BC4]">{eyebrow}</div>
          <h2 id={titleId} className="mt-1 font-display text-2xl font-semibold leading-tight text-[#0A2540]">{title}</h2>
        </div>
        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" data-testid="button-close-detail"
          className="shrink-0 rounded-md p-2 text-[#3A4E63] hover:bg-[#0A2540]/6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <X className="h-4 w-4" />
        </button>
      </header>
      <section className="px-6 pb-6 pt-4">{children}</section>
    </ModalSurface>
  );
}
