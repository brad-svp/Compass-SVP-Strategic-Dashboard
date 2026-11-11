import type { ReactNode } from 'react';
import { useGetSession } from '@workspace/api-client-react';
import { LogoMark } from '@/components/brand-logo';
import { AccessDenied } from '@/components/access-denied';
import { ErrorPanel } from '@/components/ui-bits';
import { SessionContext } from '@/lib/session-context';
import { errorMessage, errorStatus } from '@/lib/format';

export function StaffGate({ children }: { children: ReactNode }) {
  const session = useGetSession({ query: { retry: false } });

  if (session.isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background" data-testid="loading-session">
        <div className="flex flex-col items-center gap-4">
          <LogoMark className="h-12 w-12 animate-pulse" />
          <div className="text-sm font-medium text-muted-foreground">Checking your staff access</div>
        </div>
      </div>
    );
  }
  if (session.isError) {
    const status = errorStatus(session.error);
    if (status === 401 || status === 403) return <AccessDenied status={status} />;
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-lg items-center px-4">
        <ErrorPanel message={errorMessage(session.error)} onRetry={() => session.refetch()} />
      </div>
    );
  }
  if (!session.data) return null;
  return <SessionContext.Provider value={session.data}>{children}</SessionContext.Provider>;
}
