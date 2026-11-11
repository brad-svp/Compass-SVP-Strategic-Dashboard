import { createContext, useContext } from 'react';
import type { Staff } from '@workspace/api-client-react';

export const SessionContext = createContext<Staff | null>(null);

export function useStaffSession() {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useStaffSession must be used within StaffGate');
  return s;
}
