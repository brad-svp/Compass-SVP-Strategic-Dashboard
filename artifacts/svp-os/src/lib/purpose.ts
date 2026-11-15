import type { SvpPurpose, SvpPurposeInput, SvpValue } from '@workspace/api-client-react';

export const PURPOSE_LIMITS = { statement: 6000, values: 30, id: 80, title: 200, description: 4000 } as const;

export type PurposeDraft = { mission: string; vision: string; values: SvpValue[] };

export function draftFromPurpose(p: SvpPurpose): PurposeDraft {
  return { mission: p.mission, vision: p.vision, values: p.values.map((v) => ({ ...v })) };
}

export function newValue(makeId: () => string = () => crypto.randomUUID()): SvpValue {
  return { id: makeId(), title: '', description: '' };
}

export function moveValue(values: SvpValue[], index: number, dir: -1 | 1): SvpValue[] {
  const j = index + dir;
  if (index < 0 || j < 0 || j >= values.length) return values;
  const next = [...values];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

export type PurposeErrors = { mission?: string; vision?: string; values?: string; byId: Record<string, { title?: string; description?: string }> };

export function validatePurpose(d: PurposeDraft): PurposeErrors {
  const e: PurposeErrors = { byId: {} };
  if (d.mission.length > PURPOSE_LIMITS.statement) e.mission = `Under ${PURPOSE_LIMITS.statement} characters.`;
  if (d.vision.length > PURPOSE_LIMITS.statement) e.vision = `Under ${PURPOSE_LIMITS.statement} characters.`;
  if (d.values.length > PURPOSE_LIMITS.values) e.values = `At most ${PURPOSE_LIMITS.values} values.`;
  const seen = new Set<string>();
  for (const v of d.values) {
    if (!v.id || v.id.length > PURPOSE_LIMITS.id || seen.has(v.id)) e.values = 'Each value needs a unique id. Remove and re-add the duplicate.';
    seen.add(v.id);
    const r: { title?: string; description?: string } = {};
    if (!v.title.trim()) r.title = 'Give this value a title.';
    else if (v.title.trim().length > PURPOSE_LIMITS.title) r.title = `Under ${PURPOSE_LIMITS.title} characters.`;
    if (v.description.length > PURPOSE_LIMITS.description) r.description = `Under ${PURPOSE_LIMITS.description} characters.`;
    if (r.title || r.description) e.byId[v.id] = r;
  }
  return e;
}

export function hasErrors(e: PurposeErrors) {
  return !!(e.mission || e.vision || e.values || Object.keys(e.byId).length);
}

export function toPurposeInput(d: PurposeDraft, expectedVersion: number): SvpPurposeInput {
  return {
    mission: d.mission.trim(), vision: d.vision.trim(),
    values: d.values.map((v) => ({ id: v.id, title: v.title.trim(), description: v.description.trim() })),
    expectedVersion,
  };
}

export function isDirty(d: PurposeDraft, p: SvpPurpose) {
  return JSON.stringify(toPurposeInput(d, 0)) !== JSON.stringify(toPurposeInput(draftFromPurpose(p), 0));
}

export function safeHttpUrl(u: string): string | null {
  try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : null; } catch { return null; }
}
