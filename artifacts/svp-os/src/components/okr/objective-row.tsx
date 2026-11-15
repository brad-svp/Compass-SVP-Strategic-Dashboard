import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowDown, ArrowUp, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Foundation, Objective, OkrWorkspace } from '@workspace/api-client-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { StaffAvatar } from '@/components/ui-bits';
import { HealthDot, ProgressTrack, ScopeChip, StatusChip } from '@/components/okr/bits';
import { ConfirmDelete, KeyResultDialog, ObjectiveDialog } from '@/components/okr/dialogs';
import { KrCard } from '@/components/okr/kr-card';
import { bySort, swapOrder, type OkrActions } from '@/lib/okr';
import { cn } from '@/lib/utils';

export type Ctx = { foundation: Foundation; ws: OkrWorkspace; actions: OkrActions; cycleId: string };

export function ObjectiveRow({ o, ctx, siblings, index, showOwner = true }: {
  o: Objective; ctx: Ctx; siblings: Objective[]; index: number; showOwner?: boolean;
}) {
  const { foundation, ws, actions } = ctx;
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [krOpen, setKrOpen] = useState(false);
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
          <Link href={`/qbos/${o.id}`} className="mt-1.5 block font-display text-[1.15rem] font-semibold leading-snug text-[#0A2540] hover:text-[#1D8BC4] md:text-[1.3rem]" data-testid={`link-objective-${o.id}`}>
            {o.title}
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <HealthDot health={measured ? o.health : 'none'} />
            <ProgressTrack value={o.progress} expected={o.expectedProgress} health={o.health} measured={measured} className="max-w-md flex-1" />
            <span className="font-mono text-[12px] tabular-nums text-[#0A2540]" data-testid={`text-progress-${o.id}`}>{measured ? `${Math.round(o.progress)}%` : 'No key results'}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span>{krs.length} key result{krs.length === 1 ? '' : 's'}</span>
            <Link href={`/qbos/${o.id}#discussion`} className="hover:text-[#1D8BC4]">{ws.comments.filter(c => c.entityType === 'objective' && c.entityId === o.id).length} comments</Link>
            {children.length > 0 && <span>{children.length} legacy supporting</span>}
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

          {o.level === 'company' && children.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3A4E63]">Legacy supporting objectives</div>
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
                        <Link href={`/qbos/${c.id}`} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#1D8BC4]/[0.05]" data-testid={`link-support-${c.id}`}>
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
    </div>
  );
}

