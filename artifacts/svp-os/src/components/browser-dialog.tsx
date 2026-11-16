import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { ModalSurface } from './modal-surface';

/** Shared popup form, isolated from page stacking contexts. */
export function BrowserDialog({ open, onOpenChange, title, description, children, testId = 'form-browser-dialog' }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; children: ReactNode; testId?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <ModalSurface open={open} onClose={() => onOpenChange(false)} labelledBy={titleId} describedBy={descriptionId}
      className="pointer-events-auto relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-[#FBFAF6] p-6 text-foreground shadow-xl outline-none"
      testId={testId}
    >
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h2 id={titleId} className="font-display text-2xl font-semibold text-[#0A2540]">{title}</h2>
          <p id={descriptionId} className="text-sm text-muted-foreground">{description}</p>
        </div>
        <button type="button" onClick={() => onOpenChange(false)}
          className="shrink-0 rounded-md p-2 text-[#3A4E63] hover:bg-[#0A2540]/6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </header>
      {children}
    </ModalSurface>
  );
}
