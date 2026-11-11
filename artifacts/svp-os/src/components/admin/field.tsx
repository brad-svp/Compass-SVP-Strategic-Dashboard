import type { ReactNode } from 'react';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-[#3A4E63]">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
