import { useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Foundation } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/native-select';
import { isQbo, qboHref } from '@/lib/qbo';
import { WithFoundation } from '@/components/with-foundation';
import { ErrorPanel, PageSkeleton, Panel, StaffAvatar } from '@/components/ui-bits';
import { HealthLabel, InlineText, ProgressTrack, ScopeChip } from '@/components/okr/bits';
import { ConfirmDelete, KeyResultDialog, ObjectiveDialog } from '@/components/okr/dialogs';
import { KrCard } from '@/components/okr/kr-card';
import { CommentThread } from '@/components/okr/comments';
import { OBJ_STATUSES, bySort, swapOrder, useOkrActions, useOkrWorkspace } from '@/lib/okr';
import { errorMessage } from '@/lib/format';

function DetailBody({ foundation }: { foundation: Foundation }) {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const q = useOkrWorkspace();
  const actions = useOkrActions();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [krOpen, setKrOpen] = useState(false);
  const [krEventMode, setKrEventMode] = useState(false);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const ws = q.data;
  const o = ws.objectives.find((x) => x.id === params.id);
  if (!o) {
    return (
      <Panel className="flex flex-col items-start gap-3">
        <p className="font-display text-2xl text-[#0A2540]">This objective is no longer in the workspace.</p>
        <Link href="/qbos" className="font-semibold text-[#1D8BC4]" data-testid="link-back-missing">Back to QBOs</Link>
      </Panel>
    );
  }
  const owner = foundation.staff.find((s) => s.id === o.ownerId);
  const area = foundation.areas.find((a) => a.id === o.areaId);
  const cycle = foundation.cycles.find((c) => c.id === o.cycleId);
  const parent = o.parentObjectiveId ? ws.objectives.find((x) => x.id === o.parentObjectiveId) : undefined;
  const children = ws.objectives.filter((c) => c.parentObjectiveId === o.id).sort(bySort);
  const krs = ws.keyResults.filter((k) => k.objectiveId === o.id).sort(bySort);
  const measured = krs.length > 0;
  const qbo = isQbo(o);
  const back = qbo ? qboHref({ cycle: o.cycleId, q: o.timeScope }) : qboHref({ cycle: o.cycleId, view: 'legacy', owner: o.level === 'individual' ? o.ownerId : null });

  return (
    <div className="space-y-6">
      <Link href={back} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#3A4E63] hover:text-[#1D8BC4]" data-testid="link-back">
        <ArrowLeft className="h-4 w-4" /> {qbo ? `${o.timeScope} QBOs` : 'Legacy objectives'}
      </Link>

      <header className="rise">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1D8BC4]">
          {qbo ? `${o.timeScope} QBO` : o.level === 'company' ? 'Legacy annual objective' : 'Legacy individual objective'} <span className="text-[#3A4E63]">·</span> {cycle?.name} <ScopeChip scope={o.timeScope} />
        </div>
        <InlineText value={o.title} canEdit={o.canEdit} testId="text-objective-title" className="mt-2 font-display text-3xl font-semibold leading-tight text-[#0A2540] md:text-[2.4rem]"
          onSave={(v) => actions.updateObjective(o.id, { title: v }, 'Title saved')} />
        <div className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#3A4E63]">
          <InlineText value={o.description ?? ''} canEdit={o.canEdit} multiline placeholder="Add a description" testId="text-objective-description"
            onSave={(v) => actions.updateObjective(o.id, { description: v }, 'Description saved')} />
        </div>
        {parent && (
          <Link href={`/qbos/${parent.id}`} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1D8BC4]/8 px-3 py-1.5 text-[13px] text-[#0A2540] hover:bg-[#1D8BC4]/14" data-testid="link-parent">
            <span className="font-semibold text-[#1D8BC4]">Supports</span> {parent.title}
          </Link>
        )}
      </header>

      <Panel className="rise grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-5xl font-semibold tabular-nums text-[#0A2540]" data-testid="text-objective-progress">{measured ? `${Math.round(o.progress)}%` : '--'}</span>
            <HealthLabel health={measured ? o.health : 'none'} />
          </div>
          <ProgressTrack value={o.progress} expected={o.expectedProgress} health={o.health} measured={measured} className="mt-3 h-2" />
          <p className="mt-2 text-[12px] text-muted-foreground">{measured ? `Expected by today: ${Math.round(o.expectedProgress)}%` : 'Add a key result to start measuring.'}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Owner</div>
            <div className="mt-1 flex items-center gap-2 font-semibold text-[#0A2540]"><StaffAvatar name={owner?.name ?? '?'} url={owner?.avatarUrl} color={area?.color} size="h-6 w-6" />{owner?.name ?? 'Unassigned'}</div></div>
          <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Area</div>
            <div className="mt-1 flex items-center gap-2 font-semibold text-[#0A2540]"><span className="h-2 w-2 rounded-full" style={{ background: area?.color }} />{area?.name ?? 'None'}</div></div>
          <div className="col-span-2"><div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Status</div>
            {o.canEdit ? (
              <NativeSelect value={o.status} onChange={(e) => actions.updateObjective(o.id, { status: e.target.value as 'active' }, 'Status updated')} wrapClassName="w-40" className="capitalize" data-testid="select-objective-status">
                {OBJ_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </NativeSelect>
            ) : <span className="font-semibold capitalize text-[#0A2540]">{o.status}</span>}
          </div>
          {o.canEdit && (
            <div className="col-span-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} data-testid="button-edit-objective"><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
              <Button size="sm" variant="ghost" className="text-[#B03E71]" onClick={() => setDelOpen(true)} data-testid="button-delete-objective"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove</Button>
            </div>
          )}
        </div>
      </Panel>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-[#0A2540]">Key results</h2>
          {o.canEdit && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setKrEventMode(true); setKrOpen(true); }} data-testid="button-add-event-metric"><CalendarDays className="mr-1 h-4 w-4" />Event metric</Button>
              <Button size="sm" onClick={() => { setKrEventMode(false); setKrOpen(true); }} className="bg-[#0A2540] text-white" data-testid="button-add-kr"><Plus className="mr-1 h-4 w-4" />Key result</Button>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {krs.map((k, i) => (
            <KrCard key={k.id} kr={k} objective={o} foundation={foundation} checkIns={ws.checkIns} comments={ws.comments} actions={actions} detailed krCount={krs.length}
              onMove={(dir) => swapOrder(krs, i, dir, (id, sortOrder) => actions.updateKeyResult(id, { sortOrder }, ''))}
              canMoveUp={!!krs[i - 1]?.canEdit} canMoveDown={!!krs[i + 1]?.canEdit} />
          ))}
          {krs.length === 0 && <Panel className="border-dashed text-[14px] text-muted-foreground">No key results yet, so there is nothing to check in on.</Panel>}
        </div>
      </section>

      {o.level === 'company' && children.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-[#0A2540]">Legacy supporting objectives <span className="font-mono text-sm text-muted-foreground">{children.length}</span></h2>
          {children.length === 0 ? <p className="text-[14px] text-muted-foreground">No individual objectives support this yet.</p> : (
            <ul className="grid gap-2 md:grid-cols-2">
              {children.map((c) => {
                const s = foundation.staff.find((x) => x.id === c.ownerId);
                const ck = ws.keyResults.some((k) => k.objectiveId === c.id);
                return (
                  <li key={c.id}>
                    <Link href={`/qbos/${c.id}`} className="lift flex items-center gap-3 rounded-xl border border-border bg-card p-3" data-testid={`link-child-${c.id}`}>
                      <StaffAvatar name={s?.name ?? '?'} url={s?.avatarUrl} color={foundation.areas.find((a) => a.id === s?.areaId)?.color} size="h-8 w-8" />
                      <div className="min-w-0 flex-1"><div className="truncate font-medium text-[#0A2540]">{c.title}</div><div className="text-[11px] text-muted-foreground">{s?.name} · {c.timeScope}</div></div>
                      <span className="font-mono text-[12px]">{ck ? `${Math.round(c.progress)}%` : '--'}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section id="discussion"><Panel><CommentThread entityType="objective" entityId={o.id} comments={ws.comments} staff={foundation.staff} actions={actions} /></Panel></section>

      {o.canEdit && (
        <>
          <ObjectiveDialog open={editOpen} onOpenChange={setEditOpen} foundation={foundation} objectives={ws.objectives} cycleId={o.cycleId} actions={actions} editing={o} />
          <ConfirmDelete open={delOpen} onOpenChange={setDelOpen} what="objective" name={o.title}
            onConfirm={async () => { if (await actions.deleteObjective(o.id)) setLocation(back); }} />
          <KeyResultDialog open={krOpen} onOpenChange={setKrOpen} foundation={foundation} objective={o} existingCount={krs.length} actions={actions} startInEventMode={krEventMode} />
        </>
      )}
    </div>
  );
}

export default function QboDetail() {
  return <WithFoundation>{(data) => <DetailBody foundation={data} />}</WithFoundation>;
}
