import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getGetSixViewPreferencesQueryKey, getSaveSixViewPreferencesMutationKey, getSixViewPreferences, saveSixViewPreferences,
  type SixItem, type SixViewPreferences, type Staff,
} from '@workspace/api-client-react';
import { errorMessage } from '@/lib/format';

export const sixViewKey = (staffId: string) => [...getGetSixViewPreferencesQueryKey(), staffId] as const;

/** People to render, in order: actor first, then by name. Pure. */
export function selectPeople(pref: SixViewPreferences, staff: Staff[], items: SixItem[], actor: Staff, periodIds?: string[]): Staff[] {
  const withActor = staff.some((s) => s.id === actor.id) ? staff : [actor, ...staff];
  const order = (list: Staff[]) => [...list].sort((a, b) => (a.id === actor.id ? -1 : b.id === actor.id ? 1 : a.name.localeCompare(b.name)));
  if (pref.mode === 'mine') return [withActor.find((s) => s.id === actor.id) ?? actor];
  if (pref.mode === 'all') {
    const owners = new Set(items.filter((i) => !periodIds || periodIds.includes(i.periodId)).map((i) => i.ownerId));
    return order(withActor.filter((s) => s.active || s.id === actor.id || owners.has(s.id)));
  }
  const ids = new Set(pref.staffIds);
  return order(withActor.filter((s) => ids.has(s.id)));
}

export type SaveState = { status: 'idle' | 'saving' | 'saved' | 'error'; message?: string };

/** Account-bound 6x6 view choice. Shared by the dashboard and the 6x6 page; persisted server-side per signed-in account. */
export function useSixViewPreferences(me: Staff) {
  const qc = useQueryClient();
  const key = sixViewKey(me.id);
  const q = useQuery({ queryKey: key, queryFn: ({ signal }) => getSixViewPreferences({ signal }) });
  const seq = useRef(0);
  const [save, setSave] = useState<SaveState>({ status: 'idle' });
  const lastWanted = useRef<SixViewPreferences | null>(null);

  const m = useMutation({
    mutationKey: [...getSaveSixViewPreferencesMutationKey(), me.id],
    scope: { id: `six-view-preferences-${me.id}` }, // serialized: last write lands last
    mutationFn: (v: { pref: SixViewPreferences; n: number }) => saveSixViewPreferences(v.pref),
    onSuccess: (data, v) => {
      if (v.n === seq.current) { qc.setQueryData(key, data); setSave({ status: 'saved' }); }
    },
    onError: async (e, v) => {
      if (v.n !== seq.current) return; // a newer choice is pending; keep it
      setSave({ status: 'error', message: errorMessage(e) });
      await qc.invalidateQueries({ queryKey: key });
    },
  });

  function choose(pref: SixViewPreferences) {
    const n = ++seq.current;
    lastWanted.current = pref;
    qc.setQueryData(key, pref);
    setSave({ status: 'saving' });
    m.mutate({ pref, n });
  }
  const retry = () => { if (lastWanted.current) choose(lastWanted.current); else q.refetch(); };

  return { pref: q.data ?? null, isLoading: q.isLoading, isError: q.isError, error: q.error, refetch: q.refetch, choose, save, retry };
}
export type SixViewPrefs = ReturnType<typeof useSixViewPreferences>;
