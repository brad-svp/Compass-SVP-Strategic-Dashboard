import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { X } from 'lucide-react';
import { ModalSurface } from '../modal-surface';
import { cn } from '@/lib/utils';

// Older forms use the same popup layer, not a second Radix focus scope.
const Context = React.createContext<{ open: boolean; change: (value: boolean) => void; titleId: string; descriptionId: string } | null>(null);
function useEditor() {
  const value = React.useContext(Context);
  if (!value) throw Error('Editor controls require a Dialog parent.');
  return value;
}
function Dialog({ open: controlled, defaultOpen = false, onOpenChange, children }: {
  open?: boolean; defaultOpen?: boolean; onOpenChange?: (value: boolean) => void; children: React.ReactNode; modal?: boolean;
}) {
  const [local, setLocal] = React.useState(defaultOpen);
  const titleId = React.useId(), descriptionId = React.useId();
  return <Context.Provider value={{ open: controlled ?? local, titleId, descriptionId, change: value => { setLocal(value); onOpenChange?.(value); } }}>{children}</Context.Provider>;
}
type ControlProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean };
const DialogTrigger = React.forwardRef<HTMLButtonElement, ControlProps>(({ asChild, onClick, ...props }, ref) => {
  const editor = useEditor();
  const Component = asChild ? Slot : 'button';
  return <Component type="button" {...props} ref={ref} onClick={e => { onClick?.(e); if (!e.defaultPrevented) editor.change(true); }} />;
});
DialogTrigger.displayName = 'DialogTrigger';
const DialogClose = React.forwardRef<HTMLButtonElement, ControlProps>(({ asChild, onClick, ...props }, ref) => {
  const editor = useEditor();
  const Component = asChild ? Slot : 'button';
  return <Component type="button" {...props} ref={ref} onClick={e => { onClick?.(e); if (!e.defaultPrevented) editor.change(false); }} />;
});
DialogClose.displayName = 'DialogClose';
const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ children, className, ...props }, ref) => {
  const editor = useEditor();
  return <ModalSurface open={editor.open} onClose={() => editor.change(false)} labelledBy={editor.titleId}
    describedBy={editor.descriptionId} testId="legacy-form-dialog" className="relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-xl border bg-card p-6 shadow-xl outline-none">
    <div {...props} ref={ref} className={cn('relative grid gap-5 rounded-xl border border-border bg-card p-5 sm:p-8', className)}>
      {children}
      <DialogClose aria-label="Close" className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></DialogClose>
    </div>
  </ModalSurface>;
});
DialogContent.displayName = 'DialogContent';
const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>((props, ref) => {
  const editor = useEditor();
  return <h1 {...props} id={editor.titleId} ref={ref} className={cn('pr-8 font-display text-3xl font-semibold text-[#0A2540]', props.className)} />;
});
DialogTitle.displayName = 'DialogTitle';
const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>((props, ref) => {
  const editor = useEditor();
  return <p {...props} id={editor.descriptionId} ref={ref} className={cn('text-sm leading-relaxed text-muted-foreground', props.className)} />;
});
DialogDescription.displayName = 'DialogDescription';
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props} className={cn('space-y-2 text-left', className)} />;
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props} className={cn('flex flex-wrap justify-end gap-2 border-t border-border pt-4', className)} />;
const DialogPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const DialogOverlay = (_props: React.HTMLAttributes<HTMLDivElement>) => null;
export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter, DialogPortal, DialogOverlay };
