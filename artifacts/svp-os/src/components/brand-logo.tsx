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
      <LogoMark light={light} />
      <div className="min-w-0 leading-none" aria-hidden="true">
        <div className={cn('font-display truncate text-lg font-semibold', light ? 'text-[#F6F3EC]' : 'text-[#0A2540]')}>
          SVP Compass
        </div>
        <div className={cn('mt-1 text-[10px] font-semibold uppercase tracking-[0.18em]', light ? 'text-[#8FC6E4]' : 'text-[#006AB6]')}>
          Sacramento
        </div>
      </div>
    </div>
  );
}
