import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Native <select> styled to the brand. Used everywhere a popup must survive the embedded preview. */
export function NativeSelect({ className, wrapClassName, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { wrapClassName?: string }) {
  return (
    <div className={cn('relative', wrapClassName)}>
      <select
        {...rest}
        className={cn(
          'h-9 w-full appearance-none rounded-lg border border-input bg-card pl-3 pr-8 text-[13px] font-medium text-[#0A2540] shadow-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-[#1D8BC4]/40 disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3A4E63]" />
    </div>
  );
}
