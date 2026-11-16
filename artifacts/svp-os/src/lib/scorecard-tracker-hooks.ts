import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getGetFoundationQueryKey,
  getGetScorecardQueryKey,
  getGetScorecardTrackerQueryKey,
  getGetScorecardTrendQueryKey,
  getScorecardTrend,
  useAppendScorecardMeasurement,
  useCreateScorecardMetric,
  useDeleteScorecardMeasurement,
  useGetScorecardTracker,
  useUpdateScorecardMetric,
  type ScorecardMeasurement,
  type ScorecardMetricInput,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, errorStatus } from '@/lib/format';
import { byRecorded } from '@/lib/scorecard-tracker';

export function useTracker() {
  return useGetScorecardTracker({ query: { queryKey: getGetScorecardTrackerQueryKey(), refetchInterval: 30_000, refetchOnWindowFocus: true } });
}

/** Thrown when a later page fails; carries everything loaded so far so nothing is silently truncated. */
export class TrendPartialError extends Error {
  constructor(public loaded: ScorecardMeasurement[], public cause: unknown) { super(errorMessage(cause)); }
}

export async function fetchAllTrend(metricId: string, onProgress?: (n: number, pages: number) => void) {
  const all: ScorecardMeasurement[] = [];
  let after: string | undefined;
  for (let page = 1; page < 100_000; page++) {
    try {
      const r = await getScorecardTrend(after ? { metricId, after, limit: 250 } : { metricId, limit: 250 });
      all.push(...r.entries);
      onProgress?.(all.length, page);
      if (!r.nextCursor) break;
      after = r.nextCursor;
    } catch (e) {
      throw new TrendPartialError([...all], e);
    }
  }
  return all.sort(byRecorded);
}

export const trendAllKey = (metricId: string) => [...getGetScorecardTrendQueryKey({ metricId }), 'all'] as const;

export function useFullTrend(metricId: string | null) {
  const [progress, setProgress] = useState({ loaded: 0, pages: 0 });
  const q = useQuery({
    queryKey: trendAllKey(metricId ?? ''),
    queryFn: () => { setProgress({ loaded: 0, pages: 0 }); return fetchAllTrend(metricId!, (loaded, pages) => setProgress({ loaded, pages })); },
    enabled: !!metricId,
    refetchInterval: 30_000,
    retry: false,
  });
  const partial = q.error instanceof TrendPartialError ? q.error.loaded : null;
  return { ...q, progress, partial };
}

export type ActionResult = { ok: true } | { ok: false; message: string };

export function useTrackerActions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateScorecardMetric();
  const update = useUpdateScorecardMetric();
  const append = useAppendScorecardMeasurement();
  const del = useDeleteScorecardMeasurement();

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: getGetScorecardTrackerQueryKey() }),
    qc.invalidateQueries({ queryKey: getGetScorecardTrendQueryKey() }),
    qc.invalidateQueries({ queryKey: getGetScorecardQueryKey() }),
    qc.invalidateQueries({ queryKey: getGetFoundationQueryKey() }),
  ]);

  async function run(p: () => Promise<unknown>, success: string, quiet = false): Promise<ActionResult> {
    try {
      await p();
      await refresh();
      if (!quiet) toast({ title: success });
      return { ok: true };
    } catch (e) {
      const conflict = errorStatus(e) === 409;
      const server = errorMessage(e);
      const message = conflict
        ? `${server ? server + ' ' : ''}This metric changed or its history blocks the edit. Your draft is kept; reopen to see the latest version.`
        : server;
      toast({ title: conflict ? 'Not saved: conflict' : 'Not saved', description: message, variant: 'destructive' });
      if (conflict) await refresh();
      return { ok: false, message };
    }
  }

  return {
    pending: create.isPending || update.isPending,
    recording: append.isPending,
    deleting: del.isPending,
    createMetric: (data: ScorecardMetricInput) => run(() => create.mutateAsync({ data }), 'Metric added'),
    updateMetric: (id: string, data: ScorecardMetricInput, msg = 'Metric saved', quiet = false) => run(() => update.mutateAsync({ id, data }), msg, quiet),
    record: (metricId: string, value: number, note: string) => run(() => append.mutateAsync({ id: metricId, data: { value, note } }), 'Value recorded'),
    remove: (id: string) => run(() => del.mutateAsync({ id }), 'Entry deleted'),
  };
}
export type TrackerActions = ReturnType<typeof useTrackerActions>;
