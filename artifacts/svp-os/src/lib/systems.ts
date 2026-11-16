import type { SvpSystem, SvpSystemInput } from '@workspace/api-client-react';

export const LIMITS = { name: 200, url: 2000, purpose: 12002, howUsed: 8000, audience: 2000, category: 100, cadence: 200, accessInstructions: 4000, usedByIds: 100 } as const;

export type SystemDraft = Omit<SvpSystemInput, 'expectedVersion'>;

export function blankSystem(): SystemDraft {
  return { name: '', url: '', purpose: '', howUsed: '', audience: '', usedByIds: [], ownerId: null, category: '', cadence: '', accessInstructions: '', status: 'active' };
}

/** Combined "how/why we use it": unique non-empty trimmed purpose and howUsed, joined by a blank line. */
export function howWhy(s: Pick<SvpSystemInput, 'purpose' | 'howUsed'>) {
  const parts: string[] = [];
  for (const t of [s.purpose.trim(), s.howUsed.trim()]) if (t && !parts.includes(t)) parts.push(t);
  return parts.join('\n\n');
}

/** Editing consolidates how+why into purpose; audience/cadence/usedByIds pass through untouched. */
export function draftFrom(s: SvpSystem): SystemDraft {
  return { name: s.name, url: s.url, purpose: howWhy(s), howUsed: '', audience: s.audience, usedByIds: [...s.usedByIds], ownerId: s.ownerId, category: s.category, cadence: s.cadence, accessInstructions: s.accessInstructions, status: s.status };
}

/** Returns an error message, or null when the URL is a credential-free http(s) URL. */
export function urlError(raw: string): string | null {
  const v = raw.trim();
  if (!v) return 'Add the link people open.';
  if (v.length > LIMITS.url) return `Keep the link under ${LIMITS.url} characters.`;
  let u: URL;
  try { u = new URL(v); } catch { return 'Use a full link starting with https://'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Only http or https links.';
  if (u.username || u.password) return 'Remove the username or password from the link.';
  return null;
}

const SECRETISH = /(password|passwd|pwd|passcode|api[ _-]?key|secret|token)\s*[:=]\s*\S+/i;
export function looksSecret(text: string) { return SECRETISH.test(text); }

export function validateSystem(d: SystemDraft): Partial<Record<keyof SystemDraft, string>> {
  const e: Partial<Record<keyof SystemDraft, string>> = {};
  if (!d.name.trim()) e.name = 'Name the system.';
  else if (d.name.length > LIMITS.name) e.name = `Under ${LIMITS.name} characters.`;
  const u = urlError(d.url); if (u) e.url = u;
  for (const k of ['purpose', 'howUsed', 'audience', 'category', 'cadence', 'accessInstructions'] as const) {
    if (d[k].length > LIMITS[k]) e[k] = `Under ${LIMITS[k]} characters.`;
  }
  if (d.usedByIds.length > LIMITS.usedByIds) e.usedByIds = `At most ${LIMITS.usedByIds} people.`;
  if (looksSecret(d.accessInstructions)) e.accessInstructions = 'This looks like a password or key. Point to the password manager instead.';
  return e;
}

export function toInput(d: SystemDraft, expectedVersion: number): SvpSystemInput {
  return {
    ...d, name: d.name.trim(), url: d.url.trim(), purpose: d.purpose.trim(), howUsed: '', audience: d.audience,
    category: d.category.trim(), cadence: d.cadence, accessInstructions: d.accessInstructions.trim(), expectedVersion,
  };
}

export function hostOf(url: string) {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; }
}

export function filterSystems(list: SvpSystem[], q: { text: string; category: string; showRetired: boolean }, staffName: (id: string) => string = () => '') {
  const t = q.text.trim().toLowerCase();
  return list
    .filter((s) => q.showRetired || s.status === 'active')
    .filter((s) => !q.category || s.category.trim() === q.category)
    .filter((s) => !t || [s.name, s.url, s.purpose, s.howUsed, s.audience, s.category, s.cadence, s.accessInstructions,
      s.ownerId ? staffName(s.ownerId) : '', ...s.usedByIds.map(staffName)].join(' ').toLowerCase().includes(t))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function categoriesOf(list: SvpSystem[]) {
  return Array.from(new Set(list.map((s) => s.category.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
