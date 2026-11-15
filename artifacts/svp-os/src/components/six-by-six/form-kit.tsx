import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { RotateCw } from 'lucide-react';

export const inputCls =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-[#0A2540] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D8BC4]/40 disabled:cursor-not-allowed disabled:opacity-60';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-[#3A4E63]">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-lg border border-[#B03E71]/30 bg-[#B03E71]/[0.06] px-3 py-2 text-sm text-[#8E2D58]" data-testid="text-form-error">{message}</p>;
}

export function ConflictNotice({ onReopen }: { onReopen: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-lg border border-[#ECA519]/50 bg-[#ECA519]/10 px-3 py-2.5 text-sm text-[#6B4600]" data-testid="notice-conflict">
      <span>Someone else saved a newer version. Your draft is kept below so you can copy it, but saving is blocked until you reopen with the latest.</span>
      <button type="button" onClick={onReopen} className="inline-flex w-fit items-center gap-1.5 rounded-md bg-[#0A2540] px-3 py-1.5 text-[13px] font-semibold text-[#FBFAF6] hover:bg-[#0A2540]/90" data-testid="button-reopen-latest">
        <RotateCw className="h-3.5 w-3.5" /> Reopen latest
      </button>
    </div>
  );
}

export function Btn({ tone = 'primary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'ghost' | 'danger' }) {
  const t = tone === 'primary' ? 'bg-[#0A2540] text-[#FBFAF6] hover:bg-[#0A2540]/90'
    : tone === 'danger' ? 'bg-[#B03E71] text-[#FBFAF6] hover:bg-[#B03E71]/90'
    : 'border border-border bg-card text-[#0A2540] hover:bg-[#0A2540]/[0.04]';
  return <button {...rest} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${t} ${className}`} />;
}
