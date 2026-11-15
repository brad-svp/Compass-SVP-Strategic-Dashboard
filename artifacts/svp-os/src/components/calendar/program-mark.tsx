import { createContext, useContext, useState } from 'react';
import type { CalendarEvent } from '@workspace/api-client-react';
import { programColor } from '@/lib/calendar';
import { indexPrograms, programFor, programInitials, type ProgramIndex } from '@/lib/calendar-programs';

export const ProgramIndexContext = createContext<ProgramIndex>(indexPrograms([]));
export const useProgramIndex = () => useContext(ProgramIndexContext);

/** Resolve the managed program for an event (id first, name fallback). */
export function useEventProgram(e: Pick<CalendarEvent, 'program' | 'programId'>) {
  const idx = useProgramIndex();
  const p = programFor(e, idx);
  const name = p?.name ?? e.program;
  return { program: p, name, logoUrl: p?.logoUrl ?? null, color: programColor(name) };
}

/**
 * Logo if one exists; otherwise the program colour with initials.
 * A logo that fails to load falls back silently, never a broken image.
 */
export function ProgramMark({ name, logoUrl, size = 20, className = '', testId }: { name: string; logoUrl: string | null; size?: number; className?: string; testId?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const color = programColor(name || '?');
  const box = { width: size, height: size };
  if (logoUrl && failed !== logoUrl) {
    return (
      <span className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-[5px] bg-[#FBFAF6] ring-1 ring-[#0A2540]/10 ${className}`} style={box} data-testid={testId}>
        <img src={logoUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(logoUrl)} className="h-full w-full object-contain" />
      </span>
    );
  }
  if (!name) return null;
  return (
    <span aria-hidden className={`inline-grid shrink-0 place-items-center rounded-[5px] font-semibold leading-none text-[#FBFAF6] ${className}`}
      style={{ ...box, background: color, fontSize: Math.max(8, Math.round(size * 0.42)) }} data-testid={testId}>
      {programInitials(name)}
    </span>
  );
}

export function EventProgramMark({ e, size, className, testId }: { e: CalendarEvent; size?: number; className?: string; testId?: string }) {
  const { name, logoUrl } = useEventProgram(e);
  if (!name) return null;
  return <ProgramMark name={name} logoUrl={logoUrl} size={size} className={className} testId={testId} />;
}
