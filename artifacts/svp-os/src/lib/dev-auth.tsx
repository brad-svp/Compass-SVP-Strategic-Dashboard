import { createContext, useContext, type ReactNode } from 'react';
import { useClerk } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetDevAuth, deleteDevAuth } from '@workspace/api-client-react';

const DevAuthContext = createContext({ enabled: false, signedIn: false, loading: false });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function DevAuthProvider({ children }: { children: ReactNode }) {
  const status = useGetDevAuth({ query: {
    enabled: import.meta.env.DEV, retry: false, staleTime: 0,
    refetchOnWindowFocus: true, refetchInterval: 60_000,
  } });
  return <DevAuthContext.Provider value={{
    enabled: import.meta.env.DEV && status.data?.enabled === true,
    signedIn: import.meta.env.DEV && status.data?.signedIn === true,
    loading: import.meta.env.DEV && status.isLoading,
  }}>{children}</DevAuthContext.Provider>;
}

export const useDevAuth = () => useContext(DevAuthContext);

export function useWorkspaceSignOut() {
  const clerk = useClerk();
  const dev = useDevAuth();
  const cache = useQueryClient();
  return async () => {
    if (dev.enabled) await deleteDevAuth();
    cache.clear();
    if (clerk.user) await clerk.signOut({ redirectUrl: basePath || '/' });
    else window.location.assign(basePath || '/');
  };
}
