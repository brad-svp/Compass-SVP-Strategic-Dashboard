import { useQueryClient } from '@tanstack/react-query';
import {
  getGetFoundationQueryKey,
  getGetMasterCalendarQueryKey,
  useCreateCalendarEvent,
  useCreateCalendarSubscription,
  useCreateCalendarProgram,
  useUpdateCalendarProgram,
  useRequestProgramLogoUpload,
  useCompleteProgramLogoUpload,
  useDeleteCalendarEvent,
  useGetMasterCalendar,
  useRevokeCalendarSubscription,
  useUpdateCalendarEvent,
  type CalendarEventInput,
  type CalendarProgramInput,
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

export type LogoUploadResult = { ok: true; logoId: string; logoUrl: string } | { ok: false; message: string };

/** Admin program list writes + direct-to-storage logo upload. */
export function useProgramActions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateCalendarProgram();
  const update = useUpdateCalendarProgram();
  const requestUpload = useRequestProgramLogoUpload();
  const completeUpload = useCompleteProgramLogoUpload();
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: getGetMasterCalendarQueryKey() }),
    qc.invalidateQueries({ queryKey: getGetFoundationQueryKey() }),
  ]);

  async function save(p: () => Promise<unknown>, success: string): Promise<SaveResult> {
    try {
      const value = await p();
      await refresh();
      toast({ title: success });
      return { ok: true, value };
    } catch (e) {
      const conflict = errorStatus(e) === 409;
      const message = conflict
        ? 'Someone changed this program first. Your draft is kept; reopen to load the latest before saving again.'
        : errorMessage(e);
      toast({ title: conflict ? 'Changed by someone else' : 'Not saved', description: message, variant: 'destructive' });
      if (conflict) await qc.invalidateQueries({ queryKey: getGetMasterCalendarQueryKey() });
      return { ok: false, conflict, message };
    }
  }

  /** Presign -> PUT bytes directly to storage (no cookies) -> server verifies and finalises. Never logs the URL or bytes. */
  async function uploadLogo(file: File, contentType: CalendarProgramLogoType, onProgress: (pct: number) => void): Promise<LogoUploadResult> {
    try {
      onProgress(5);
      const { id, uploadURL } = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType } });
      onProgress(20);
      const put = await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file, credentials: 'omit' });
      if (!put.ok) return { ok: false, message: `Storage rejected the upload (${put.status}). Try again.` };
      onProgress(80);
      const done = await completeUpload.mutateAsync({ id });
      onProgress(100);
      await refresh();
      return { ok: true, logoId: done.logoId, logoUrl: done.logoUrl };
    } catch (e) {
      return { ok: false, message: errorMessage(e) };
    }
  }

  return {
    createProgram: (data: CalendarProgramInput) => save(() => create.mutateAsync({ data }), 'Program added'),
    updateProgram: (id: string, data: CalendarProgramInput, success = 'Program saved') => save(() => update.mutateAsync({ id, data }), success),
    uploadLogo,
  };
}
export type ProgramActions = ReturnType<typeof useProgramActions>;
type CalendarProgramLogoType = 'image/png' | 'image/jpeg' | 'image/webp';
