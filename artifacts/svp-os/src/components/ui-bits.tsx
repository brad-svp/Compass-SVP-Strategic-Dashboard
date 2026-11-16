import type { ReactNode, HTMLAttributes } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { initials, statusTone } from '@/lib/format';

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="rise mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1D8BC4]">{eyebrow}</div>
        <h1 className="font-display text-3xl font-semibold text-[#0A2540] md:text-[2.6rem] md:leading-[1.05]">{title}</h1>
        {children && <div className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span
      data-testid={`status-${status}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset',
        statusTone[status] ?? statusTone.closed,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? status}
    </span>
  );
}

export function NextPhaseTag({ children = 'Next phase' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-dashed border-[#B03E71]/50 bg-[#B03E71]/[0.06] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#8C2F59]">
      {children}
    </span>
  );
}

export function StaffAvatar({ name, url, color, size = 'h-9 w-9' }: { name: string; url?: string | null; color?: string; size?: string }) {
  return (
    <Avatar className={cn(size, 'ring-2 ring-[#F6F3EC]')}>
      {url && <AvatarImage src={url} alt={name} />}
      <AvatarFallback className="text-[12px] font-semibold text-white" style={{ background: color ?? '#0A2540' }}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function Panel({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={cn('rounded-2xl border border-card-border bg-card p-5 md:p-6', className)}>{children}</section>;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" data-testid="loading-page">
      <Skeleton className="h-4 w-28 bg-[#0A2540]/8" />
      <Skeleton className="h-10 w-80 max-w-full bg-[#0A2540]/8" />
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Skeleton className="h-64 rounded-2xl bg-[#0A2540]/6" />
        <Skeleton className="h-64 rounded-2xl bg-[#0A2540]/6" />
      </div>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Panel className="flex flex-col items-start gap-3 border-[#B03E71]/30">
      <div className="font-display text-xl text-[#0A2540]">We couldn't load this right now.</div>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry} data-testid="button-retry">
        <RotateCw className="mr-2 h-4 w-4" /> Try again
      </Button>
    </Panel>
  );
}
