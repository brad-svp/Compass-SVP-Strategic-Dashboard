import { cn } from '@/lib/utils';

/** True North mark: ring + two-part northeast needle + hub. Matches public/brand/svp-compass-mark*.svg. */
export function LogoMark({ className, light = false }: { className?: string; light?: boolean }) {
  const ring = light ? '#F6F3EC' : '#0A2540';
  const north = light ? '#5FB6E3' : '#1D8BC4';
  const south = light ? '#F6F3EC' : '#0A2540';
  const hub = light ? '#0A2540' : '#F6F3EC';
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9 shrink-0', className)} aria-hidden="true">
      <circle cx="32" cy="32" r="25" fill="none" stroke={ring} strokeWidth="5" />
      <path d="M46.5 17.5 36.6 36.6 27.4 27.4Z" fill={north} />
      <path d="M17.5 46.5 27.4 27.4 36.6 36.6Z" fill={south} />
      <circle cx="32" cy="32" r="4.2" fill={hub} />
    </svg>
  );
}

export function BrandLockup({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)} aria-label="SVP Compass, Sacramento" role="img">
      <img
        src={`${import.meta.env.BASE_URL}brand/${light ? 'svp-mark-cream' : 'svp-mark-blue'}.png`}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-8 w-auto shrink-0 select-none"
      />
      <span
        aria-hidden="true"
        className={cn('h-7 w-px shrink-0', light ? 'bg-[#F6F3EC]/30' : 'bg-[#0A2540]/20')}
      />
      <span
        aria-hidden="true"
        className={cn(
          'font-display truncate text-[22px] font-bold leading-none tracking-[-0.02em]',
          light ? 'text-[#F6F3EC]' : 'text-[#0A2540]',
        )}
      >
        Compass
      </span>
    </div>
  );
}
