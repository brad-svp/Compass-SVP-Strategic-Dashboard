import type { LucideIcon } from 'lucide-react';
import { NextPhaseTag, PageHeader, Panel } from '@/components/ui-bits';

export function PhasePreview({ eyebrow, title, intro, icon: Icon, color, items }: {
  eyebrow: string; title: string; intro: string; icon: LucideIcon; color: string; items: { title: string; body: string }[];
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} actions={<NextPhaseTag />}>{intro}</PageHeader>
      <Panel className="rise relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl" style={{ background: `${color}22` }} />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: color }}><Icon className="h-5 w-5" /></div>
          <div className="font-display text-lg text-[#0A2540]">What this space will hold</div>
        </div>
        <ol className="relative mt-6 grid gap-4 md:grid-cols-2">
          {items.map((it, i) => (
            <li key={it.title} className="rounded-xl border border-border bg-background/60 p-4">
              <div className="font-mono text-[11px]" style={{ color }}>{String(i + 1).padStart(2, '0')}</div>
              <div className="mt-1 font-semibold text-[#0A2540]">{it.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{it.body}</p>
            </li>
          ))}
        </ol>
        <p className="relative mt-6 text-sm text-muted-foreground">Nothing here is active yet. This page is a preview of the plan, not a working tool.</p>
      </Panel>
    </>
  );
}
