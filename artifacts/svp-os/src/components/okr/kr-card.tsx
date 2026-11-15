import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Gauge, Hash, Pencil, Trash2 } from 'lucide-react';
import type { CheckIn, Comment, Foundation, KeyResult, Objective } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { StaffAvatar } from '@/components/ui-bits';
import { HealthDot, InlineText, ProgressTrack, Sparkline } from '@/components/okr/bits';
import { CheckInDialog, ConfirmDelete, KeyResultDialog } from '@/components/okr/dialogs';
import { CommentThread } from '@/components/okr/comments';
import { fmtNum, krValueLabel, type OkrActions } from '@/lib/okr';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { CalendarDays } from 'lucide-react';
import { useMasterCalendar } from '@/lib/calendar-hooks';
import { calendarHref } from '@/lib/event-metric';

function EventLinkChip({ eventId }: { eventId: string }) {
  const cal = useMasterCalendar(true);
  const ev = cal.data?.events.find((e) => e.id === eventId);
  if (cal.isLoading) return <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />Event</span>;
  if (!ev) return <span className="inline-flex items-center gap-1 text-[#8E2D58]" data-testid={`text-kr-event-unavailable-${eventId}`}><CalendarDays className="h-3 w-3" />Linked event unavailable</span>;
  return (
    <Link href={calendarHref(ev)} className="inline-flex max-w-[16rem] items-center gap-1 truncate text-[#125F88] hover:underline" data-testid={`link-kr-event-${ev.id}`}>
      <CalendarDays className="h-3 w-3 shrink-0" /><span className="truncate">{ev.title}</span>
      <span className="shrink-0 text-muted-foreground">· {ev.startDate ? fmtDate(ev.startDate, 'MMM d') : `TBD ${ev.planningYear}`}</span>
    </Link>
  );
}

export function KrCard({ kr, objective, foundation, checkIns, comments, actions, detailed, onMove, canMoveUp, canMoveDown, krCount }: {
  kr: KeyResult; objective: Objective; foundation: Foundation; checkIns: CheckIn[]; comments: Comment[]; actions: OkrActions;
  detailed?: boolean; onMove?: (dir: -1 | 1) => void; canMoveUp?: boolean; canMoveDown?: boolean; krCount: number;
}) {
  const [checkOpen, setCheckOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const owner = foundation.staff.find((s) => s.id === kr.ownerId);
  const area = foundation.areas.find((a) => a.id === owner?.areaId);
  const mine = checkIns.filter((c) => c.keyResultId === kr.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const measured = kr.measurementType === 'metric' ? kr.currentValue !== null : kr.confidence !== null;
  const commentCount = comments.filter(c => c.entityType === 'key_result' && c.entityId === kr.id).length;
  const TypeIcon = kr.measurementType === 'metric' ? Hash : Gauge;

  return (
    <div className={cn('group/kr rounded-xl border border-border/80 bg-white/55 transition-colors hover:border-[#1D8BC4]/35', detailed ? 'p-4' : 'p-3')} data-testid={`card-kr-${kr.id}`}>
      <div className="flex items-start gap-3">
        <HealthDot health={measured ? kr.health : 'none'} className="mt-1.5" />
        <div className="min-w-0 flex-1">
          {detailed ? (
            <InlineText value={kr.title} canEdit={kr.canEdit} testId={`text-kr-title-${kr.id}`} className="text-[15px] font-semibold text-[#0A2540]"
              onSave={(v) => actions.updateKeyResult(kr.id, { title: v }, 'Title saved')} />
          ) : (
            <div className="text-[14px] font-medium leading-snug text-[#0A2540]" data-testid={`text-kr-title-${kr.id}`}>{kr.title}</div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><TypeIcon className="h-3 w-3" />{kr.measurementType === 'metric' ? 'Metric' : 'Confidence'}</span>
            <span className="font-mono text-[#1E3349]" data-testid={`text-kr-value-${kr.id}`}>{krValueLabel(kr)}</span>
            {kr.calendarEventId && <EventLinkChip eventId={kr.calendarEventId} />}
            {kr.lastCheckInAt && <span>updated {fmtDate(kr.lastCheckInAt, 'MMM d')}</span>}
            <span>{commentCount} comment{commentCount === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="hidden shrink-0 sm:block"><Sparkline checkIns={mine} width={detailed ? 120 : 84} /></div>
        <StaffAvatar name={owner?.name ?? 'Unassigned'} url={owner?.avatarUrl} color={area?.color} size="h-7 w-7" />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ProgressTrack value={kr.progress} health={kr.health} measured={measured} className="flex-1" />
        <span className="w-10 text-right font-mono text-[12px] tabular-nums text-[#0A2540]">{measured ? `${Math.round(kr.progress)}%` : '--'}</span>
      </div>

      {(kr.canEdit || detailed) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {kr.canEdit && (
            <Button size="sm" onClick={() => setCheckOpen(true)} className="h-8 bg-[#1D8BC4] px-3 text-white hover:bg-[#177AAE]" data-testid={`button-checkin-${kr.id}`}>
              Check in
            </Button>
          )}
          {detailed && (
            <Button size="sm" variant="ghost" onClick={() => setHistoryOpen((o) => !o)} className="h-8 px-2 text-[#3A4E63]" data-testid={`button-history-${kr.id}`}>
              History and discussion ({commentCount}) <ChevronDown className={cn('ml-1 h-3.5 w-3.5 transition-transform', historyOpen && 'rotate-180')} />
            </Button>
          )}
          {kr.canEdit && onMove && (
            <span className="ml-auto flex items-center">
              <button disabled={!canMoveUp} onClick={() => onMove(-1)} aria-label="Move up" className="rounded p-1.5 text-[#3A4E63] hover:bg-[#0A2540]/5 disabled:opacity-25" data-testid={`button-kr-up-${kr.id}`}><ArrowUp className="h-3.5 w-3.5" /></button>
              <button disabled={!canMoveDown} onClick={() => onMove(1)} aria-label="Move down" className="rounded p-1.5 text-[#3A4E63] hover:bg-[#0A2540]/5 disabled:opacity-25" data-testid={`button-kr-down-${kr.id}`}><ArrowDown className="h-3.5 w-3.5" /></button>
            </span>
          )}
          {kr.canEdit && (
            <span className={cn('flex items-center', !onMove && 'ml-auto')}>
              <button type="button" onClick={() => setEditOpen(true)} aria-label="Edit key result" title="Edit details" className="rounded p-1.5 text-[#3A4E63] hover:bg-[#0A2540]/5" data-testid={`menu-edit-kr-${kr.id}`}><Pencil className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setDelOpen(true)} aria-label="Remove key result" title="Remove" className="rounded p-1.5 text-[#B03E71] hover:bg-[#B03E71]/10" data-testid={`menu-delete-kr-${kr.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
            </span>
          )}
        </div>
      )}

      {detailed && historyOpen && (
        <div className="rise mt-4 grid gap-5 border-t border-border/70 pt-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3A4E63]">Check-in history</div>
            {mine.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No check-ins yet. Progress appears after the first one.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-[#1D8BC4]/25 pl-4">
                {mine.map((c) => {
                  const author = foundation.staff.find((s) => s.id === c.authorId);
                  return (
                    <li key={c.id} className="relative" data-testid={`checkin-${c.id}`}>
                      <span className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#1D8BC4]', c.measurementType === 'metric' ? 'bg-[#1D8BC4]' : 'bg-[#F6F3EC]')} />
                      <div className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                        <span className="font-mono font-medium text-[#0A2540]">
                          {c.measurementType === 'metric' ? `${fmtNum(c.value ?? 0)}${kr.unit ? ' ' + kr.unit : ''}` : `${c.confidence}% confidence`}
                        </span>
                        <span className="text-muted-foreground">{Math.round(c.progress)}% · {fmtDate(c.createdAt, 'MMM d, h:mm a')} · {author?.name ?? 'Former staff'}</span>
                      </div>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-[#1E3349]">{c.note}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          <CommentThread entityType="key_result" entityId={kr.id} comments={comments} staff={foundation.staff} actions={actions} />
        </div>
      )}

      <CheckInDialog open={checkOpen} onOpenChange={setCheckOpen} kr={kr} lastCheckIn={mine[0]} actions={actions} />
      {kr.canEdit && (
        <>
          <KeyResultDialog open={editOpen} onOpenChange={setEditOpen} foundation={foundation} objective={objective} existingCount={krCount} actions={actions} editing={kr} />
          <ConfirmDelete open={delOpen} onOpenChange={setDelOpen} what="key result" name={kr.title} onConfirm={() => actions.deleteKeyResult(kr.id)} />
        </>
      )}
    </div>
  );
}
