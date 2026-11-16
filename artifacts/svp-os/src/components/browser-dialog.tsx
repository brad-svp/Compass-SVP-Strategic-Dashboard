import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Browser-managed focus and modality, without a document-wide pointer-events lock. */
export function BrowserDialog({ open, onOpenChange, title, description, children, testId = 'form-browser-dialog' }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; children: ReactNode; testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onOpenChange(false); }}
      onClose={() => onOpenChange(false)}
      className="pointer-events-auto fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-[#FBFAF6] p-6 text-foreground shadow-xl backdrop:bg-black/60"
      data-testid={testId}
    >
      <header className="mb-4 space-y-1.5 pr-7">
        <h2 id={titleId} className="font-display text-2xl font-semibold text-[#0A2540]">{title}</h2>
        <p id={descriptionId} className="text-sm text-muted-foreground">{description}</p>
      </header>
      {children}
      <button type="button" onClick={() => onOpenChange(false)}
        className="absolute right-4 top-4 rounded-sm p-1 opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        aria-label="Close">
        <X className="h-4 w-4" />
      </button>
    </dialog>
  );
}
