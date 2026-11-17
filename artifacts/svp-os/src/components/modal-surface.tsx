import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const layers: HTMLElement[] = [];
let previousOverflow = '';
const focusable = 'button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[contenteditable="true"],[tabindex]:not([tabindex="-1"])';

/** A single popup layer; no competing native/Radix focus scopes or inert state. */
export function ModalSurface({ open, onClose, children, className, labelledBy, describedBy, testId }: {
  open: boolean; onClose: () => void; children: ReactNode; className: string;
  labelledBy: string; describedBy?: string; testId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return;
    const panel = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!layers.length) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    layers.push(panel);
    const controls = () => [...panel.querySelectorAll<HTMLElement>(focusable)].filter(el => el.getClientRects().length > 0 && !el.closest('[hidden],[inert]'));
    const frame = requestAnimationFrame(() => {
      if (layers.at(-1) === panel && !panel.contains(document.activeElement)) (controls()[0] ?? panel).focus();
    });
    const keydown = (event: KeyboardEvent) => {
      if (layers.at(-1) !== panel || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); closeRef.current();
      }
      if (event.key === 'Tab') {
        const elements = controls(), first = elements[0] ?? panel, last = elements.at(-1) ?? panel;
        if (!panel.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keydown);
      const wasTop = layers.at(-1) === panel;
      const index = layers.indexOf(panel);
      if (index !== -1) layers.splice(index, 1);
      if (!layers.length) document.body.style.overflow = previousOverflow;
      if (wasTop && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div data-modal-layer className="fixed inset-0 z-[2147483647] flex h-[100dvh] items-center justify-center bg-black/60 p-3">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy}
        tabIndex={-1} data-testid={testId} className={`svp-form-surface ${className}`}
        onPointerUpCapture={event => {
          // Some embedded-preview handlers cancel mousedown's default focus.
          // Repair only an unfocused, editable text control, in the trusted
          // gesture itself (important for iOS keyboard activation).
          const field = event.target;
          const editor = field instanceof HTMLElement ? field.closest<HTMLElement>('[contenteditable="true"]') : null;
          if (layers.at(-1) === ref.current && editor && ref.current?.contains(editor) && !editor.contains(editor.ownerDocument.activeElement)) {
            editor.focus({ preventScroll: true });
          }
          if (layers.at(-1) === ref.current && (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) &&
            !field.disabled && !field.readOnly && field.ownerDocument.activeElement !== field &&
            (field instanceof HTMLTextAreaElement || ['text', 'email', 'search', 'url', 'tel', 'number', 'password'].includes(field.type))) {
            field.focus({ preventScroll: true });
          }
        }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
