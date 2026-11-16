import { Children, isValidElement, useId, useLayoutEffect, useRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Check, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

function labelText(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? labelText(child.props.children) : String(child)).join('');
}
function optionsFrom(children: ReactNode, groupDisabled = false): { value: string; label: string; disabled: boolean }[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) return [];
    if (child.type === 'option') {
      const label = labelText(child.props.children);
      return [{ value: String(child.props.value ?? label), label, disabled: groupDisabled || !!child.props.disabled }];
    }
    return optionsFrom(child.props.children, groupDisabled || !!child.props.disabled);
  });
}
/**
 * Compatibility name for existing forms. This is NOT a dropdown:
 * choices are ordinary HTML buttons in a manually controlled overlay,
 * with no React portal, OS select popup or focus-loss dismissal.
 */
export function NativeSelect({ className, wrapClassName, children, value, defaultValue, onChange, disabled, id, required, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { wrapClassName?: string; 'data-testid'?: string }) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const proxy = useRef<HTMLSelectElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const choices = optionsFrom(children);
  const [internal, setInternal] = useState(String(defaultValue ?? choices[0]?.value ?? ''));
  const selected = String(value ?? internal);
  const [expanded, setExpanded] = useState(false), [search, setSearch] = useState('');
  const filtered = choices.filter(c => c.label.toLowerCase().includes(search.trim().toLowerCase()));
  const selectedChoice = choices.find(c => c.value === selected);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 180, maxHeight: 320, up: false });
  const supportsPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
  useLayoutEffect(() => {
    if (!expanded || disabled) return;
    const panel = panelRef.current;
    function align(event?: Event) {
      if (event?.target instanceof Node && panel?.contains(event.target)) return;
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      // iOS's keyboard changes the visual viewport, not necessarily innerHeight.
      const vv = window.visualViewport;
      const viewportTop = vv?.offsetTop ?? 0;
      const viewportHeight = vv?.height ?? window.innerHeight;
      const viewportLeft = vv?.offsetLeft ?? 0;
      const viewportWidth = vv?.width ?? window.innerWidth;
      const below = viewportTop + viewportHeight - rect.bottom - 12, above = rect.top - viewportTop - 12;
      const up = below < 220 && above > below;
      const width = Math.min(Math.max(rect.width, 180), viewportWidth - 24);
      const room = Math.max(0, up ? above : below);
      // If the trigger is beside the keyboard, use the visible viewport instead
      // of squeezing the list to zero between the search box and Close button.
      const useViewport = room < 160;
      setPosition({
        left: Math.max(viewportLeft + 12, Math.min(rect.left, viewportLeft + viewportWidth - width - 12)),
        top: useViewport ? viewportTop + 12 : up ? rect.top - 5 : rect.bottom + 5, width,
        maxHeight: Math.max(128, Math.min(360, useViewport ? viewportHeight - 24 : room)), up: useViewport ? false : up,
      });
    }
    align();
    // A manual HTML popover only puts our existing DOM panel above clipping
    // and modal layers. Unlike an automatic popover, it has no light-dismiss
    // behavior or focus-loss listener that could close it immediately.
    if (supportsPopover && panel && !panel.matches(':popover-open')) panel.showPopover();
    window.addEventListener('resize', align);
    window.addEventListener('scroll', align, true);
    window.visualViewport?.addEventListener('resize', align);
    window.visualViewport?.addEventListener('scroll', align);
    // The opening gesture is pointerdown -> click; this listener is installed
    // only after click opens the list, so it cannot dismiss that same gesture.
    // Do not preventDefault or refocus the trigger: the outside field must
    // receive the click and remain editable.
    function outside(event: PointerEvent) {
      const path = event.composedPath();
      if ((trigger.current && path.includes(trigger.current)) || (panel && path.includes(panel))) return;
      setExpanded(false); setSearch('');
    }
    document.addEventListener('pointerdown', outside, true);
    return () => {
      window.removeEventListener('resize', align);
      window.removeEventListener('scroll', align, true);
      window.visualViewport?.removeEventListener('resize', align);
      window.visualViewport?.removeEventListener('scroll', align);
      document.removeEventListener('pointerdown', outside, true);
      if (supportsPopover && panel?.matches(':popover-open')) panel.hidePopover();
    };
  }, [expanded, disabled, supportsPopover]);
  function choose(next: string) {
    if (!proxy.current || disabled) return;
    proxy.current.value = next;
    proxy.current.dispatchEvent(new Event('change', { bubbles: true }));
    setExpanded(false); setSearch(''); trigger.current?.focus({ preventScroll: true });
  }
  function focusChoice() {
    requestAnimationFrame(() => {
      const panel = document.getElementById(panelId);
      (panel?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]:not(:disabled)') ?? panel?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)'))?.focus();
    });
  }
  return (
    <div className={cn('min-w-0', wrapClassName)}>
      {/* Hidden value bridge retains real HTML change events for existing forms.
          It never receives focus or opens an operating-system select popup. */}
      <select
        {...rest}
        hidden aria-hidden="true" tabIndex={-1} data-testid={undefined}
        ref={proxy} value={selected} disabled={disabled} required={false}
        onChange={event => { setInternal(event.currentTarget.value); onChange?.(event); }}
      >{children}</select>
      <button
        id={id} ref={trigger} type="button" disabled={disabled}
        aria-label={rest['aria-label']} aria-labelledby={rest['aria-labelledby']}
        aria-haspopup="listbox"
        aria-expanded={expanded && !disabled} aria-controls={panelId} aria-required={required}
        data-testid={rest['data-testid']}
        onClick={() => { setExpanded(!expanded); setSearch(''); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setExpanded(true); focusChoice(); }
          if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setExpanded(false); setSearch(''); }
        }}
        className={cn(
          'flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 py-2 text-left text-[13px] font-medium text-[#0A2540] shadow-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-[#1D8BC4]/40 disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        <span className="min-w-0 break-words">{selectedChoice?.label ?? 'Choose an option'}</span>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {expanded && !disabled && (
        <div ref={panelRef} popover={supportsPopover ? 'manual' : undefined}
          style={{ position: 'fixed', inset: 'auto', margin: 0, left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight, transform: position.up ? 'translateY(-100%)' : undefined, zIndex: 1000 }}
          onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setExpanded(false); trigger.current?.focus(); } }}
          className="flex flex-col gap-1 overflow-hidden rounded-lg border-2 border-[#1D8BC4]/35 bg-card p-1.5 text-foreground shadow-xl">
          {choices.length > 8 && <label className="flex shrink-0 items-center gap-1 rounded border border-border px-2">
            <Search aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find an option…" aria-label={`Find ${rest['aria-label'] ?? 'option'}`} className="min-w-0 flex-1 bg-transparent py-2 text-[13px] outline-none" />
          </label>}
          <div id={panelId} role="listbox" aria-label={rest['aria-label'] ?? 'Available choices'}
            style={{ maxHeight: Math.max(44, position.maxHeight - (choices.length > 8 ? 72 : 24)) }}
            className="min-h-[44px] shrink space-y-0.5 overflow-y-auto overscroll-contain"
            onKeyDown={event => {
              if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setExpanded(false); trigger.current?.focus(); return; }
              if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)')];
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
              buttons[next]?.focus();
            }}>
            {filtered.map((choice, index) => <button key={`${choice.value}-${index}`} type="button" role="option"
              aria-selected={choice.value === selected} disabled={choice.disabled} onClick={() => choose(choice.value)}
              className={cn('flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1D8BC4] disabled:opacity-40', choice.value === selected ? 'bg-[#1D8BC4]/10 font-semibold text-[#0A2540]' : 'hover:bg-muted')}>
              <Check aria-hidden className={cn('h-3.5 w-3.5 shrink-0', choice.value !== selected && 'invisible')} /><span className="min-w-0 break-words">{choice.label}</span>
            </button>)}
            {!filtered.length && <p className="px-2 py-2 text-xs text-muted-foreground">No matching choices.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
