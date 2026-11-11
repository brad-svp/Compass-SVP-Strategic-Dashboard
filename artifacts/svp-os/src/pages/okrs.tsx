import { useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { ArrowDown, ArrowUp, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Foundation, Objective, OkrWorkspace } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { WithFoundation } from '@/components/with-foundation';
import { ErrorPanel, PageHeader, PageSkeleton, Panel, StaffAvatar } from '@/components/ui-bits';
import { HealthDot, ProgressTrack, ScopeChip, StatusChip } from '@/components/okr/bits';
import { ConfirmDelete, KeyResultDialog, ObjectiveDialog } from '@/components/okr/dialogs';
import { KrCard } from '@/components/okr/kr-card';
import { useStaffSession } from '@/lib/session-context';
import { avgProgress, bySort, swapOrder, useOkrActions, useOkrWorkspace, type OkrActions } from '@/lib/okr';
import { errorMessage, pickCurrentCycle } from '@/lib/format';
import { cn } from '@/lib/utils';

type Ctx = { foundation: Foundation; ws: OkrWorkspace; actions: OkrActions; cycleId: string };

function ObjectiveRow({ o, ctx, siblings, index, depth = 0, showOwner = true }: {
  o: Objective; ctx: Ctx; siblings: Objective[]; index: number; depth?: number; showOwner?: boolean;
}) {
  const { foundation, ws, actions } = ctx;
  const [open, setOpen] = useState(depth === 0 ? false : false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [krOpen, setKrOpen] = useState(false);
  const [childOpen, setChildOpen] = useState(false);
  const me = useStaffSession();
  const owner = foundation.staff.find((s) => s.id === o.ownerId);
  const area = foundation.areas.find((a) => a.id === o.areaId);
  const krs = ws.keyResults.filter((k) => k.objectiveId === o.id).sort(bySort);
  const children = o.level === 'company' ? ws.objectives.filter((c) => c.parentObjectiveId === o.id).sort(bySort) : [];
  const measured = krs.length > 0;
  const prev = siblings[index - 1];
  const next = siblings[index + 1];
  const move = (dir: -1 | 1) => swapOrder(siblings, index, dir, (id, sortOrder) => actions.updateObjective(id, { sortOrder }, ''));
  const childOwners = Array.from(new Set(children.map((c) => c.ownerId)));

  return (
    <div className={cn('rise rounded-2xl border bg-card transition-shadow', open ? 'border-[#1D8BC4]/40 shadow-[0_18px_40px_-28px_rgba(10,37,64,.45)]' : 'border-card-border')} data-testid={`row-objective-${o.id}`}>
      <div className="flex items-start gap-3 p-4 md:p-5">
        <button onClick={() => setOpen((v) => !v)} aria-label={open ? 'Collapse' : 'Expand'} data-testid={`button-expand-${o.id}`}
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#3A4E63] transition-colors hover:bg-[#0A2540]/6">
          <ChevronRight className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-90')} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: area?.color ?? '#9AA8B6' }} title={area?.name} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3A4E63]">{area?.name ?? 'No area'}</span>
            <ScopeChip scope={o.timeScope} />
            {o.status !== 'active' && <StatusChip status={o.status} />}
          </div>
          <Link href={`/okrs/${o.id}`} className="mt-1.5 block font-display text-[1.15rem] font-semibold leading-snug text-[#0A2540] hover:text-[#1D8BC4] md:text-[1.3rem]" data-testid={`link-objective-${o.id}`}>
            {o.title}
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <HealthDot health={measured ? o.health : 'none'} />
            <ProgressTrack value={o.progress} expected={o.expectedProgress} health={o.health} measured={measured} className="max-w-md flex-1" />
            <span className="font-mono text-[12px] tabular-nums text-[#0A2540]" data-testid={`text-progress-${o.id}`}>{measured ? `${Math.round(o.progress)}%` : 'No key results'}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span>{krs.length} key result{krs.length === 1 ? '' : 's'}</span>
            <Link href={`/okrs/${o.id}#discussion`} className="hover:text-[#1D8BC4]">{ws.comments.filter(c => c.entityType === 'objective' && c.entityId === o.id).length} comments</Link>
            {o.level === 'company' && <span>{children.length} supporting</span>}
            {childOwners.length > 0 && (
              <span className="flex -space-x-1.5">
                {childOwners.slice(0, 6).map((id) => {
                  const s = foundation.staff.find((x) => x.id === id);
                  return <StaffAvatar key={id} name={s?.name ?? '?'} url={s?.avatarUrl} color={foundation.areas.find((a) => a.id === s?.areaId)?.color} size="h-5 w-5" />;
                })}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showOwner && <StaffAvatar name={owner?.name ?? 'Unassigned'} url={owner?.avatarUrl} color={area?.color} size="h-8 w-8" />}
          {o.canEdit && (
            <div className="hidden flex-col sm:flex">
              <button disabled={!prev?.canEdit} onClick={() => move(-1)} aria-label="Move up" className="rounded p-1 text-[#3A4E63] hover:bg-[#0A2540]/5 disabled:opacity-20" data-testid={`button-up-${o.id}`}><ArrowUp className="h-3.5 w-3.5" /></button>
              <button disabled={!next?.canEdit} onClick={() => move(1)} aria-label="Move down" className="rounded p-1 text-[#3A4E63] hover:bg-[#0A2540]/5 disabled:opacity-20" data-testid={`button-down-${o.id}`}><ArrowDown className="h-3.5 w-3.5" /></button>
            </div>
          )}
          {o.canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-lg p-1.5 text-[#3A4E63] hover:bg-[#0A2540]/6" aria-label="Objective actions" data-testid={`button-menu-${o.id}`}><MoreHorizontal className="h-4 w-4" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)} data-testid={`menu-edit-${o.id}`}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setKrOpen(true)} data-testid={`menu-add-kr-${o.id}`}><Plus className="mr-2 h-4 w-4" />Add key result</DropdownMenuItem>
                {prev?.canEdit && <DropdownMenuItem className="sm:hidden" onClick={() => move(-1)}><ArrowUp className="mr-2 h-4 w-4" />Move up</DropdownMenuItem>}
                {next?.canEdit && <DropdownMenuItem className="sm:hidden" onClick={() => move(1)}><ArrowDown className="mr-2 h-4 w-4" />Move down</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => setDelOpen(true)} className="text-[#B03E71]" data-testid={`menu-delete-${o.id}`}><Trash2 className="mr-2 h-4 w-4" />Remove</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {open && (
        <div className="rise space-y-4 border-t border-border/70 px-4 pb-5 pt-4 md:pl-14 md:pr-5">
          <div className="space-y-2">
            {krs.map((k, i) => (
              <KrCard key={k.id} kr={k} objective={o} foundation={foundation} checkIns={ws.checkIns} comments={ws.comments} actions={actions} krCount={krs.length}
                onMove={(dir) => swapOrder(krs, i, dir, (id, sortOrder) => actions.updateKeyResult(id, { sortOrder }, ''))}
                canMoveUp={!!krs[i - 1]?.canEdit} canMoveDown={!!krs[i + 1]?.canEdit} />
            ))}
            {krs.length === 0 && <p className="text-[13px] text-muted-foreground">No key results yet, so there is nothing to check in on.</p>}
            {o.canEdit && (
              <button onClick={() => setKrOpen(true)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[#1D8BC4] hover:bg-[#1D8BC4]/8" data-testid={`button-add-kr-${o.id}`}>
                <Plus className="h-4 w-4" /> Add key result
              </button>
            )}
          </div>

          {o.level === 'company' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3A4E63]">Supporting individual objectives</div>
                <button onClick={() => setChildOpen(true)} className="flex items-center gap-1 text-[12px] font-semibold text-[#1D8BC4] hover:underline" data-testid={`button-add-support-${o.id}`}>
                  <Plus className="h-3.5 w-3.5" /> Support this
                </button>
              </div>
              {children.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-3 text-[13px] text-muted-foreground">Nobody has linked an individual objective here yet.</p>
              ) : (
                <ul className="divide-y divide-border/70 rounded-xl border border-border/80 bg-white/45">
                  {children.map((c) => {
                    const s = foundation.staff.find((x) => x.id === c.ownerId);
                    const ck = ws.keyResults.filter((k) => k.objectiveId === c.id).length > 0;
                    return (
                      <li key={c.id}>
                        <Link href={`/okrs/${c.id}`} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#1D8BC4]/[0.05]" data-testid={`link-support-${c.id}`}>
                          <StaffAvatar name={s?.name ?? '?'} url={s?.avatarUrl} color={foundation.areas.find((a) => a.id === s?.areaId)?.color} size="h-7 w-7" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-medium text-[#0A2540]">{c.title}</div>
                            <div className="text-[11px] text-muted-foreground">{s?.name ?? 'Unassigned'} · {c.timeScope}{c.status !== 'active' ? ` · ${c.status}` : ''}</div>
                          </div>
                          <HealthDot health={ck ? c.health : 'none'} />
                          <span className="w-10 text-right font-mono text-[12px] text-[#0A2540]">{ck ? `${Math.round(c.progress)}%` : '--'}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {o.canEdit && (
        <>
          <ObjectiveDialog open={editOpen} onOpenChange={setEditOpen} foundation={foundation} objectives={ws.objectives} cycleId={ctx.cycleId} actions={actions} editing={o} />
          <ConfirmDelete open={delOpen} onOpenChange={setDelOpen} what="objective" name={o.title} onConfirm={() => actions.deleteObjective(o.id)} />
          <KeyResultDialog open={krOpen} onOpenChange={setKrOpen} foundation={foundation} objective={o} existingCount={krs.length} actions={actions} />
        </>
      )}
      {o.level === 'company' && (
        <ObjectiveDialog open={childOpen} onOpenChange={setChildOpen} foundation={foundation} objectives={ws.objectives} cycleId={ctx.cycleId} actions={actions}
          preset={{ level: 'individual', parentObjectiveId: o.id, ownerId: me.id }} />
      )}
    </div>
  );
}

function OkrsBody({ foundation }: { foundation: Foundation }) {
  const me = useStaffSession();
  const isAdmin = me.role === 'admin';
  const q = useOkrWorkspace();
  const actions = useOkrActions();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(search);
  const ownerId = searchParams.get('owner');
  const requestedCycle = searchParams.get('cycle');
  const cycleId = foundation.cycles.some(c => c.id === requestedCycle) ? requestedCycle! : pickCurrentCycle(foundation.cycles)?.id ?? '';
  const setCycleId = (id: string) => setLocation(`/okrs?cycle=${encodeURIComponent(id)}${ownerId ? `&owner=${encodeURIComponent(ownerId)}` : ''}`);
  const [newOpen, setNewOpen] = useState(false);
  const [newLevel, setNewLevel] = useState<'company' | 'individual'>('individual');
  const staff = foundation.staff.filter((s) => s.active);

  const ws = q.data;
  const inCycle = useMemo(() => (ws ? ws.objectives.filter((o) => o.cycleId === cycleId) : []), [ws, cycleId]);
  const company = inCycle.filter((o) => o.level === 'company').sort(bySort);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !ws) return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;

  const ctx: Ctx = { foundation, ws, actions, cycleId };
  const selected = ownerId ? staff.find((s) => s.id === ownerId) ?? foundation.staff.find((s) => s.id === ownerId) : undefined;
  const personObjs = ownerId ? inCycle.filter((o) => o.level === 'individual' && o.ownerId === ownerId).sort(bySort) : [];
  const canAddForPerson = ownerId && (isAdmin || ownerId === me.id);
  const openNew = (level: 'company' | 'individual') => { setNewLevel(level); setNewOpen(true); };
  const setOwner = (id: string | null) => setLocation(`/okrs?cycle=${encodeURIComponent(cycleId)}${id ? `&owner=${encodeURIComponent(id)}` : ''}`);
  const cycle = foundation.cycles.find((c) => c.id === cycleId);

  return (
    <>
      <PageHeader eyebrow={cycle ? `${cycle.name} · alignment` : 'Alignment'} title={selected ? `${selected.name.split(' ')[0]}'s objectives` : 'Company to individual.'}
        actions={
          <>
            {foundation.cycles.length > 1 && (
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger className="h-9 w-40 bg-card" data-testid="select-cycle"><SelectValue /></SelectTrigger>
                <SelectContent>{foundation.cycles.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {isAdmin && !selected && <Button onClick={() => openNew('company')} className="bg-[#0A2540] text-white" data-testid="button-new-company"><Plus className="mr-1.5 h-4 w-4" />Company objective</Button>}
            {company.length > 0 && (!selected || canAddForPerson) && (
              <Button onClick={() => openNew('individual')} variant={selected ? 'default' : 'outline'} className={selected ? 'bg-[#0A2540] text-white' : 'bg-card'} data-testid="button-new-individual">
                <Plus className="mr-1.5 h-4 w-4" />Individual objective
              </Button>
            )}
          </>
        }>
        {selected ? 'Every individual objective supports one company objective in the same cycle.' : 'Expand a company objective to see who is carrying it and how their key results are moving.'}
      </PageHeader>

      <div className="-mx-4 mb-6 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex min-w-max gap-2" role="tablist">
          <button onClick={() => setOwner(null)} role="tab" aria-selected={!ownerId} data-testid="tab-owner-all"
            className={cn('rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all', !ownerId ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-border bg-card text-[#3A4E63] hover:border-[#0A2540]/40')}>
            Company view
          </button>
          {staff.map((s) => {
            const objs = inCycle.filter((o) => o.ownerId === s.id && o.level === 'individual');
            const p = avgProgress(objs, ws.keyResults);
            const active = ownerId === s.id;
            return (
              <button key={s.id} onClick={() => setOwner(s.id)} role="tab" aria-selected={active} data-testid={`tab-owner-${s.id}`}
                className={cn('flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13px] font-semibold transition-all', active ? 'border-[#1D8BC4] bg-[#1D8BC4]/10 text-[#0A2540]' : 'border-border bg-card text-[#3A4E63] hover:border-[#1D8BC4]/50')}>
                <StaffAvatar name={s.name} url={s.avatarUrl} color={foundation.areas.find((a) => a.id === s.areaId)?.color} size="h-6 w-6" />
                {s.id === me.id ? 'You' : s.name.split(' ')[0]}
                <span className="font-mono text-[11px] font-normal text-muted-foreground">{objs.length}{p != null ? ` · ${p}%` : ''}</span>
              </button>
            );
          })}
        </div>
      </div>

      {company.length === 0 ? (
        <Panel className="rise flex flex-col items-start gap-4 border-dashed border-[#1D8BC4]/40 bg-[#1D8BC4]/[0.04] py-10" >
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1D8BC4]">{cycle?.name ?? 'This cycle'}</div>
          <p className="font-display text-2xl text-[#0A2540] md:text-3xl" data-testid="text-empty-okrs">Start by adding your company objectives.</p>
          <p className="max-w-lg text-[14px] text-muted-foreground">
            {isAdmin ? 'Three to five annual objectives give everyone something to anchor their own work to.' : 'An admin sets company objectives first. Once they exist, you can add your own beneath them.'}
          </p>
          {isAdmin && <Button onClick={() => openNew('company')} className="bg-[#0A2540] text-white" data-testid="button-empty-new-company"><Plus className="mr-1.5 h-4 w-4" />Add company objective</Button>}
        </Panel>
      ) : selected ? (
        <div className="space-y-8">
          {company.map((c) => {
            const mine = personObjs.filter((o) => o.parentObjectiveId === c.id);
            if (mine.length === 0) return null;
            return (
              <section key={c.id}>
                <Link href={`/okrs/${c.id}`} className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#3A4E63] hover:text-[#1D8BC4]" data-testid={`link-parent-${c.id}`}>
                  <span className="h-px w-6 bg-[#1D8BC4]" /> Supports: <span className="normal-case tracking-normal text-[#0A2540]">{c.title}</span>
                </Link>
                <div className="space-y-3">{mine.map((o, i) => <ObjectiveRow key={o.id} o={o} ctx={ctx} siblings={mine} index={i} showOwner={false} />)}</div>
              </section>
            );
          })}
          {personObjs.length === 0 && (
            <Panel className="flex flex-col items-start gap-3 border-dashed">
              <p className="font-display text-xl text-[#0A2540]">No individual objectives for {selected.name.split(' ')[0]} in this cycle.</p>
              <p className="text-[14px] text-muted-foreground">Pick a company objective and add a personal commitment that moves it.</p>
              {canAddForPerson && <Button onClick={() => openNew('individual')} className="bg-[#0A2540] text-white" data-testid="button-empty-new-individual"><Plus className="mr-1.5 h-4 w-4" />Add objective</Button>}
            </Panel>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {company.map((o, i) => <ObjectiveRow key={o.id} o={o} ctx={ctx} siblings={company} index={i} />)}
        </div>
      )}

      <ObjectiveDialog open={newOpen} onOpenChange={setNewOpen} foundation={foundation} objectives={ws.objectives} cycleId={cycleId} actions={actions}
        preset={{ level: newLevel, ownerId: ownerId ?? me.id }} />
    </>
  );
}

export default function Okrs() {
  return <WithFoundation>{(data) => <OkrsBody foundation={data} />}</WithFoundation>;
}
