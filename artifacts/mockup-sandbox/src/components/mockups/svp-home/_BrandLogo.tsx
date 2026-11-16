import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9 shrink-0', className)} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0A2540" />
      <rect x="13" y="13" width="17" height="17" rx="4" fill="#1D8BC4" />
      <rect x="34" y="13" width="17" height="17" rx="8.5" fill="#49B949" />
      <rect x="13" y="34" width="17" height="17" rx="8.5" fill="#ECA519" />
      <rect x="34" y="34" width="17" height="17" rx="4" fill="#B03E71" />
      <circle cx="32" cy="32" r="4" fill="#F6F3EC" />
    </svg>
  );
}

export function BrandLockup({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoMark className={light ? 'ring-1 ring-white/15 rounded-[10px]' : undefined} />
      <div className="leading-none">
        <div className={cn('font-display text-lg font-semibold', light ? 'text-[#F6F3EC]' : 'text-[#0A2540]')}>
          SVP OS
        </div>
        <div className={cn('mt-1 text-[10px] font-semibold uppercase tracking-[0.18em]', light ? 'text-[#8FC6E4]' : 'text-[#1D8BC4]')}>
          Sacramento
        </div>
      </div>
    </div>
  );
}
