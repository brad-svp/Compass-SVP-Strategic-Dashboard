import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateFoundationItem, useUpdateFoundationItem, getGetFoundationQueryKey, getGetSessionQueryKey,
  type FoundationInput,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/format';

type Collection = 'staff' | 'areas' | 'cycles';

export function useFoundationWrite() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateFoundationItem();
  const update = useUpdateFoundationItem();

  const done = (label: string, onDone?: () => void) => ({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getGetFoundationQueryKey() });
      qc.invalidateQueries({ queryKey: getGetSessionQueryKey() });
      toast({ title: label });
      onDone?.();
    },
    onError: (e: unknown) => toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' }),
  });

  return {
    pending: create.isPending || update.isPending,
    save(collection: Collection, id: string | null, data: FoundationInput, onDone?: () => void) {
      if (id) update.mutate({ collection, id, data }, done('Changes saved', onDone));
      else create.mutate({ collection, data }, done('Added', onDone));
    },
  };
}
