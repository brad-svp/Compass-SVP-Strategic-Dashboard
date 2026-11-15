import type { CalendarEvent, CalendarProgram, CalendarProgramInput, ProgramLogoUploadRequestContentType } from '@workspace/api-client-react';

/** Program lookup + logo helpers. Pure functions so they are unit-testable. */

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES: ProgramLogoUploadRequestContentType[] = ['image/png', 'image/jpeg', 'image/webp'];
export const LOGO_ACCEPT = LOGO_TYPES.join(',');

export type ProgramIndex = { byId: Map<string, CalendarProgram>; byName: Map<string, CalendarProgram> };

const norm = (s: string) => s.trim().toLowerCase();

export function indexPrograms(programs: CalendarProgram[] | undefined): ProgramIndex {
  const byId = new Map<string, CalendarProgram>();
  const byName = new Map<string, CalendarProgram>();
  for (const p of programs ?? []) { byId.set(p.id, p); byName.set(norm(p.name), p); }
  return { byId, byName };
}

/** Prefer programId; fall back to name match for legacy rows. */
export function programFor(e: Pick<CalendarEvent, 'program' | 'programId'>, idx: ProgramIndex): CalendarProgram | null {
  if (e.programId) { const p = idx.byId.get(e.programId); if (p) return p; }
  return e.program ? idx.byName.get(norm(e.program)) ?? null : null;
}

/** Display name: managed current name wins over the event's stored string. */
export function programLabel(e: Pick<CalendarEvent, 'program' | 'programId'>, idx: ProgramIndex) {
  return programFor(e, idx)?.name ?? e.program;
}

export function programInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Filter list: actual programs plus names used by existing events (inactive included). */
export function filterProgramNames(programs: CalendarProgram[] | undefined, events: Pick<CalendarEvent, 'program'>[]) {
  const seen = new Map<string, string>();
  for (const p of programs ?? []) seen.set(norm(p.name), p.name.trim());
  for (const e of events) { const n = e.program.trim(); if (n && !seen.has(norm(n))) seen.set(norm(n), n); }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export type ProgramChoice = { value: string; label: string; inactive: boolean; unmanaged: boolean };

/** Event-form choices: active programs, plus the event's current program kept when retired or unmanaged. */
export function programChoices(programs: CalendarProgram[] | undefined, current: string): ProgramChoice[] {
  const list: ProgramChoice[] = (programs ?? []).filter((p) => p.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ value: p.name, label: p.name, inactive: false, unmanaged: false }));
  const cur = current.trim();
  if (cur && !list.some((c) => norm(c.value) === norm(cur))) {
    const managed = (programs ?? []).find((p) => norm(p.name) === norm(cur));
    list.unshift({ value: managed?.name ?? cur, label: `${managed?.name ?? cur} (${managed ? 'retired' : 'not in program list'})`, inactive: true, unmanaged: !managed });
  }
  return list;
}

export type LogoCheck = { ok: true; contentType: ProgramLogoUploadRequestContentType } | { ok: false; error: string };

export function validateLogoFile(f: { name: string; size: number; type: string }): LogoCheck {
  const t = f.type.toLowerCase() === 'image/jpg' ? 'image/jpeg' : f.type.toLowerCase();
  if (!LOGO_TYPES.includes(t as ProgramLogoUploadRequestContentType)) return { ok: false, error: 'Logo must be a PNG, JPEG or WEBP image.' };
  if (f.size <= 0) return { ok: false, error: 'That file is empty.' };
  if (f.size > LOGO_MAX_BYTES) return { ok: false, error: `Logo is ${(f.size / 1048576).toFixed(1)} MB; the limit is 2 MB.` };
  if (!f.name.trim() || f.name.length > 255) return { ok: false, error: 'File name must be 1 to 255 characters.' };
  return { ok: true, contentType: t as ProgramLogoUploadRequestContentType };
}

export type ProgramDraft = { name: string; logoId: string | null; logoUrl: string | null; active: boolean };

export function draftFromProgram(p: CalendarProgram | null): ProgramDraft {
  return p ? { name: p.name, logoId: p.logoId, logoUrl: p.logoUrl, active: p.active } : { name: '', logoId: null, logoUrl: null, active: true };
}

export type ProgramBuild = { ok: true; input: CalendarProgramInput } | { ok: false; error: string };

export function buildProgramInput(d: ProgramDraft, expectedVersion: number, others: CalendarProgram[], selfId: string | null): ProgramBuild {
  const name = d.name.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'Give the program a name.' };
  if (name.length > 120) return { ok: false, error: 'Program names are limited to 120 characters.' };
  if (others.some((p) => p.id !== selfId && norm(p.name) === norm(name))) return { ok: false, error: `"${name}" is already in the program list.` };
  return { ok: true, input: { name, logoId: d.logoId, active: d.active, expectedVersion } };
}
