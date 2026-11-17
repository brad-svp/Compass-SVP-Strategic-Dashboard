import type { Cycle, Objective } from '@workspace/api-client-react';

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export type Quarter = (typeof QUARTERS)[number];

export function isQuarter(v: string | null | undefined): v is Quarter {
  return !!v && (QUARTERS as readonly string[]).includes(v);
}

/** A QBO is a company-level objective scoped to a single quarter. Everything else is legacy. */
export function isQbo(o: Objective) {
  return o.level === 'company' && isQuarter(o.timeScope);
}

/** Calendar quarters match the server's quarter boundaries, including partial-year cycles. */
export function currentQuarter(cycle?: Cycle, now = new Date()): Quarter {
  if (cycle) {
    const today = now.toISOString().slice(0, 10);
    const bounded = today < cycle.startDate ? cycle.startDate : today > cycle.endDate ? cycle.endDate : today;
    return QUARTERS[Math.floor((Number(bounded.slice(5, 7)) - 1) / 3)];
  }
  return QUARTERS[Math.floor(now.getUTCMonth() / 3)];
}

export function qboHref(params: { cycle?: string; year?: string; q?: string; view?: string; owner?: string | null }) {
  const sp = new URLSearchParams();
  if (params.cycle) sp.set('cycle', params.cycle);
  if (params.year) sp.set('year', params.year);
  if (params.q) sp.set('q', params.q);
  if (params.view) sp.set('view', params.view);
  if (params.owner) sp.set('owner', params.owner);
  const s = sp.toString();
  return `/qbos${s ? `?${s}` : ''}`;
}
