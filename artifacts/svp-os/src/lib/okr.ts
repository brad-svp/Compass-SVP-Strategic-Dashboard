import { useQueryClient } from '@tanstack/react-query';
import {
  getGetFoundationQueryKey,
  getGetOkrWorkspaceQueryKey,
  useCreateCheckIn,
  useCreateComment,
  useCreateKeyResult,
  useCreateObjective,
  useDeleteComment,
  useDeleteKeyResult,
  useDeleteObjective,
  useGetOkrWorkspace,
  useUpdateComment,
  useUpdateKeyResult,
  useUpdateObjective,
  type CheckInInput,
  type CommentInput,
  type KeyResult,
  type KeyResultInput,
  type KeyResultUpdate,
  type Objective,
  type ObjectiveInput,
  type ObjectiveUpdate,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/format';

export const SCOPES = ['annual', 'Q1', 'Q2', 'Q3', 'Q4'] as const;
export const OBJ_STATUSES = ['draft', 'active', 'closed'] as const;

export const HEALTH: Record<string, { color: string; label: string }> = {
  green: { color: '#49B949', label: 'On pace' },
  yellow: { color: '#ECA519', label: 'Watch' },
  red: { color: '#B03E71', label: 'Behind' },
  none: { color: '#9AA8B6', label: 'No check-in' },
};

export function useOkrWorkspace() {
  return useGetOkrWorkspace({ query: { queryKey: getGetOkrWorkspaceQueryKey(), refetchInterval: 30_000, refetchOnWindowFocus: true } });
}

export function bySort<T extends { sortOrder: number; title: string }>(a: T, b: T) {
  return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);
}

/** Average progress across ALL given objectives; objectives without key results count as 0. null only when there are no objectives. */
export function avgProgress(objs: Objective[], krs: KeyResult[]): number | null {
  if (!objs.length) return null;
  const sum = objs.reduce((s, o) => s + (krs.some((k) => k.objectiveId === o.id) ? o.progress : 0), 0);
  return Math.round(sum / objs.length);
}

export function useOkrActions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const cObj = useCreateObjective();
  const uObj = useUpdateObjective();
  const dObj = useDeleteObjective();
  const cKr = useCreateKeyResult();
  const uKr = useUpdateKeyResult();
  const dKr = useDeleteKeyResult();
  const cCheck = useCreateCheckIn();
  const cCom = useCreateComment();
  const uCom = useUpdateComment();
  const dCom = useDeleteComment();

  async function run<T>(p: () => Promise<T>, success?: string): Promise<T | null> {
    try {
      const r = await p();
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetOkrWorkspaceQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetFoundationQueryKey() }),
      ]);
      if (success) toast({ title: success });
      return r;
    } catch (e) {
      toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' });
      return null;
    }
  }

  return {
    pending:
      cObj.isPending || uObj.isPending || dObj.isPending || cKr.isPending || uKr.isPending || dKr.isPending ||
      cCheck.isPending || cCom.isPending || uCom.isPending || dCom.isPending,
    createObjective: (data: ObjectiveInput) => run(() => cObj.mutateAsync({ data }), 'Objective added'),
    updateObjective: (id: string, data: ObjectiveUpdate, msg = 'Objective updated') => run(() => uObj.mutateAsync({ id, data }), msg),
    deleteObjective: (id: string) => run(() => dObj.mutateAsync({ id }), 'Objective removed from workspace'),
    createKeyResult: (data: KeyResultInput) => run(() => cKr.mutateAsync({ data }), 'Key result added'),
    updateKeyResult: (id: string, data: KeyResultUpdate, msg = 'Key result updated') => run(() => uKr.mutateAsync({ id, data }), msg),
    deleteKeyResult: (id: string) => run(() => dKr.mutateAsync({ id }), 'Key result removed from workspace'),
    createCheckIn: (id: string, data: CheckInInput) => run(() => cCheck.mutateAsync({ id, data }), 'Check-in recorded'),
    createComment: (data: CommentInput) => run(() => cCom.mutateAsync({ data })),
    updateComment: (id: string, body: string) => run(() => uCom.mutateAsync({ id, data: { body } }), 'Comment edited'),
    deleteComment: (id: string) => run(() => dCom.mutateAsync({ id }), 'Comment deleted'),
  };
}

export type OkrActions = ReturnType<typeof useOkrActions>;

/**
 * Move an item one step. Distinct values: swap the pair. Tied values: renumber the
 * editable items to their new index (non-editable items are never patched).
 * Patches run sequentially; a failed patch stops the rest and invalidation restores truth.
 */
export async function swapOrder<T extends { id: string; sortOrder: number; canEdit: boolean }>(
  list: T[], index: number, dir: -1 | 1, patch: (id: string, sortOrder: number) => Promise<unknown>,
) {
  const a = list[index];
  const b = list[index + dir];
  if (!a || !b || !a.canEdit || !b.canEdit) return;
  const plan: [string, number][] = [];
  if (a.sortOrder !== b.sortOrder) {
    plan.push([a.id, b.sortOrder], [b.id, a.sortOrder]);
  } else {
    const next = [...list];
    next[index] = b; next[index + dir] = a;
    next.forEach((item, i) => { if (item.canEdit && item.sortOrder !== i) plan.push([item.id, i]); });
  }
  for (const [id, so] of plan) {
    const r = await patch(id, Math.max(0, so));
    if (r == null) return;
  }
}

export function krValueLabel(kr: KeyResult) {
  if (kr.measurementType === 'confidence') return kr.confidence == null ? 'No check-in yet' : `${kr.confidence}% confident`;
  return kr.currentValue == null ? 'No check-in yet' : `${fmtNum(kr.currentValue)} of ${fmtNum(kr.targetValue)}${kr.unit ? ' ' + kr.unit : ''}`;
}

export function fmtNum(n: number) {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
