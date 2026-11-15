/** Civil-time helpers pinned to an IANA zone (never the browser's local zone). No dependencies. */
export const CAL_TZ = 'America/Los_Angeles';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HHMM = /^(\d{2}):(\d{2})$/;

export function isValidIsoDate(s: string | null | undefined): s is string {
  const m = s ? ISO_DATE.exec(s) : null;
  if (!m) return false;
  const y = Number(m[1]);
  if (y < 1900 || y > 9999) return false;
  const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === y && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmtCache.set(tz, f);
  }
  return f;
}

/** UTC instant -> civil date/time in tz. */
export function utcToZoned(ms: number, tz = CAL_TZ) {
  const p: Record<string, string> = {};
  for (const x of partsFmt(tz).formatToParts(new Date(ms))) p[x.type] = x.value;
  const hour = p.hour === '24' ? '00' : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hour}:${p.minute}`, seconds: Number(p.second) };
}

function offsetAt(ms: number, tz: string) {
  const z = utcToZoned(ms, tz);
  const [y, mo, d] = z.date.split('-').map(Number);
  const [h, mi] = z.time.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, z.seconds) - Math.floor(ms / 1000) * 1000;
}

export type ZonedResult =
  | { ok: true; iso: string; ambiguous: boolean }
  | { ok: false; reason: 'invalid' | 'nonexistent' };

/**
 * Civil date + HH:MM in tz -> UTC ISO. Tries the zone offsets on either side of the
 * moment and keeps only candidates that round-trip exactly. Gaps (spring forward) are
 * rejected; overlaps (fall back) resolve to the earlier instant and are flagged.
 */
export function zonedToUtc(date: string, time: string, tz = CAL_TZ): ZonedResult {
  const t = HHMM.exec(time);
  if (!isValidIsoDate(date) || !t || Number(t[1]) > 23 || Number(t[2]) > 59) return { ok: false, reason: 'invalid' };
  const [y, mo, d] = date.split('-').map(Number);
  const naive = Date.UTC(y, mo - 1, d, Number(t[1]), Number(t[2]));
  const offsets = new Set([offsetAt(naive - 86_400_000, tz), offsetAt(naive, tz), offsetAt(naive + 86_400_000, tz)]);
  const hits = [...offsets].map((o) => naive - o)
    .filter((ms) => { const z = utcToZoned(ms, tz); return z.date === date && z.time === time; })
    .sort((a, b) => a - b);
  if (!hits.length) return { ok: false, reason: 'nonexistent' };
  return { ok: true, iso: new Date(hits[0]).toISOString(), ambiguous: new Set(hits).size > 1 };
}

export function todayInZone(tz = CAL_TZ, now = Date.now()) {
  return utcToZoned(now, tz).date;
}

/** "6:30 PM" in tz. */
export function fmtTime(iso: string, tz = CAL_TZ) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

/* ---------- pure civil-date math (UTC-anchored, zone-free) ---------- */

export function addDaysIso(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function dayOfWeek(iso: string) { return new Date(iso + 'T00:00:00Z').getUTCDay(); }
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function fmtDay(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(new Date(iso + 'T00:00:00Z'));
}
