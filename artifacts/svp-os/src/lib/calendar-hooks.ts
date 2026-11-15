import { useQueryClient } from '@tanstack/react-query';
import {
  getGetFoundationQueryKey,
  getGetMasterCalendarQueryKey,
  useCreateCalendarEvent,
  useCreateCalendarSubscription,
  useDeleteCalendarEvent,
  useGetMasterCalendar,
  useRevokeCalendarSubscription,
  useUpdateCalendarEvent,
  type CalendarEventInput,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, errorStatus } from '@/lib/format';

export function useMasterCalendar(enabled = true) {
  return useGetMasterCalendar({ query: { queryKey: getGetMasterCalendarQueryKey(), enabled, refetchInterval: enabled ? 30_000 : false, refetchOnWindowFocus: enabled } });
}

export type SaveResult = { ok: true; value?: unknown } | { ok: false; conflict: boolean; message: string };

export function useCalendarActions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateCalendarEvent();
  const update = useUpdateCalendarEvent();
  const del = useDeleteCalendarEvent();
  const subscribe = useCreateCalendarSubscription();
  const revoke = useRevokeCalendarSubscription();

  async function run(p: () => Promise<unknown>, success: string): Promise<SaveResult> {
    try {
      const value = await p();
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetMasterCalendarQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetFoundationQueryKey() }),
      ]);
      toast({ title: success });
      return { ok: true, value };
    } catch (e) {
      const conflict = errorStatus(e) === 409;
      const message = conflict
        ? 'Someone changed this event first. Your draft is kept; reopen to load the latest before saving again.'
        : errorMessage(e);
      toast({ title: conflict ? 'Changed by someone else' : 'Not saved', description: message, variant: 'destructive' });
      if (conflict) await qc.invalidateQueries({ queryKey: getGetMasterCalendarQueryKey() });
      return { ok: false, conflict, message };
    }
  }

  return {
    createEvent: (data: CalendarEventInput) => run(() => create.mutateAsync({ data }), 'Event added'),
    updateEvent: (id: string, data: CalendarEventInput) => run(() => update.mutateAsync({ id, data }), 'Event saved'),
    deleteEvent: (id: string, expectedVersion: number) => run(() => del.mutateAsync({ id, data: { expectedVersion } }), 'Event deleted'),
    /** Returns the feed path; caller holds it in memory only. */
    createSubscription: async () => {
      const r = await run(() => subscribe.mutateAsync(), 'Private feed link created');
      return r.ok ? ((r.value as { path?: string } | undefined)?.path ?? null) : null;
    },
    revokeSubscription: () => run(() => revoke.mutateAsync(), 'Feed link revoked'),
    subPending: subscribe.isPending || revoke.isPending,
  };
}
export type CalendarActions = ReturnType<typeof useCalendarActions>;
