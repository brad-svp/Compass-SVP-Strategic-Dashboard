import { format, parseISO, isValid } from 'date-fns';
import type { Area, Cycle } from '@workspace/api-client-react';

export function fmtDate(value?: string | null, pattern = 'MMM d, yyyy') {
  if (!value) return '';
  const d = parseISO(value);
  return isValid(d) ? format(d, pattern) : value;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function areaById(areas: Area[], id: string) {
  return areas.find((a) => a.id === id);
}

export function pickCurrentCycle(cycles: Cycle[]) {
  return cycles.find((c) => c.status === 'active') ?? cycles.find((c) => c.status === 'planning') ?? cycles[0];
}

export function errorStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const s = (err as { status: unknown }).status;
    return typeof s === 'number' ? s : undefined;
  }
  return undefined;
}

export function errorMessage(err: unknown) {
  if (err && typeof err === 'object' && 'data' in err) {
    const d = (err as { data: unknown }).data;
    if (d && typeof d === 'object' && 'error' in d && typeof (d as { error: unknown }).error === 'string') {
      return (d as { error: string }).error;
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export const statusTone: Record<string, string> = {
  active: 'bg-[#49B949]/15 text-[#22702A] ring-[#49B949]/40',
  planning: 'bg-[#ECA519]/15 text-[#8A5A00] ring-[#ECA519]/45',
  closed: 'bg-[#0A2540]/8 text-[#3A4E63] ring-[#0A2540]/20',
  upcoming: 'bg-[#1D8BC4]/12 text-[#125F88] ring-[#1D8BC4]/35',
};
