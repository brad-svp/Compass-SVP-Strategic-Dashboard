import type { ReactNode } from 'react';
import { useGetFoundation, type Foundation } from '@workspace/api-client-react';
import { AccessDenied } from '@/components/access-denied';
import { ErrorPanel, PageSkeleton } from '@/components/ui-bits';
import { errorMessage, errorStatus } from '@/lib/format';

export function WithFoundation({ children }: { children: (data: Foundation) => ReactNode }) {
  const q = useGetFoundation();
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) {
    const s = errorStatus(q.error);
    if (s === 401 || s === 403) return <AccessDenied status={s} />;
    return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  if (!q.data) return null;
  return <>{children(q.data)}</>;
}
