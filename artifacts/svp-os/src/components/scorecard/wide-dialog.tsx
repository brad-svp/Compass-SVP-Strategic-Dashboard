import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { ModalSurface } from '../modal-surface';

/** Shared modal layer with room for a chart and history ledger. */
export function WideDialog({ open, onOpenChange, title, eyebrow, children, testId }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; eyebrow: ReactNode; children: ReactNode; testId: string;
}) {
  const titleId = useId();
  return (
    <ModalSurface open={open} onClose={() => onOpenChange(false)} labelledBy={titleId}
      className="pointer-events-auto relative max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-[#FBFAF6] p-0 text-foreground shadow-2xl outline-none"
      testId={testId}>
      <header className="sticky top-0 z-10 border-b border-[#0A2540]/8 bg-[#FBFAF6]/95 px-6 pb-4 pt-5 backdrop-blur">
        <div className="pr-8 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#1D8BC4]">{eyebrow}</div>
        <h2 id={titleId} className="mt-1 pr-8 font-display text-2xl font-semibold leading-tight text-[#0A2540]">{title}</h2>
        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" data-testid="button-close-detail"
          className="absolute right-4 top-4 rounded-md p-1.5 text-[#3A4E63] hover:bg-[#0A2540]/6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="px-6 pb-6 pt-4">{children}</div>
    </ModalSurface>
  );
}
