import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk } from '@clerk/react';
import {
  LayoutDashboard, Target, Grid3x3, Users, Workflow, GraduationCap, Settings, ShieldCheck, LogOut, Menu,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { BrandLockup } from '@/components/brand-logo';
import { StaffAvatar } from '@/components/ui-bits';
import { useStaffSession } from '@/lib/session-context';
import { cn } from '@/lib/utils';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/okrs', label: 'OKRs', icon: Target, soon: true },
  { href: '/six-by-six', label: '6x6', icon: Grid3x3 },
  { href: '/team', label: 'Team & Ownership', icon: Users },
  { href: '/systems', label: 'Systems', icon: Workflow, soon: true },
  { href: '/learn', label: 'Learn', icon: GraduationCap, soon: true },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const me = useStaffSession();
  const items = me.role === 'admin' ? [...NAV, { href: '/admin', label: 'Admin', icon: ShieldCheck }] : NAV;
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = location === item.href || location.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            data-testid={`link-nav-${item.href.slice(1)}`}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors',
              active ? 'bg-white/10 text-white' : 'text-[#C9D6E3] hover:bg-white/5 hover:text-white',
            )}
          >
            <span className={cn('absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#1D8BC4] transition-transform origin-center', active ? 'scale-y-100' : 'scale-y-0')} />
            <Icon className={cn('h-[18px] w-[18px] transition-transform group-hover:scale-110', active ? 'text-[#5FB6E3]' : '')} />
            <span className="flex-1">{item.label}</span>
            {'soon' in item && item.soon && (
              <span className="rounded bg-white/8 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#ECA519]">Soon</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const me = useStaffSession();
  const { signOut } = useClerk();
  return (
    <div className="flex h-full flex-col bg-[#0A2540] px-4 py-6">
      <Link href="/dashboard" className="mb-8 px-2" data-testid="link-home-logo" onClick={onNavigate}>
        <BrandLockup light />
      </Link>
      <NavList onNavigate={onNavigate} />
      <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center gap-3">
          <StaffAvatar name={me.name} url={me.avatarUrl} color="#1D8BC4" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white" data-testid="text-current-user">{me.name}</div>
            <div className="text-[11px] uppercase tracking-wider text-[#8FC6E4]">{me.role}</div>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: basePath || '/' })}
            className="grid h-8 w-8 place-items-center rounded-md text-[#C9D6E3] transition hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
            data-testid="button-signout-sidebar"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grain min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        <SidebarBody />
      </aside>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#0A2540]/10 bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <BrandLockup />
        <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg border border-border" aria-label="Open menu" data-testid="button-open-menu">
          <Menu className="h-5 w-5 text-[#0A2540]" />
        </button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-10 md:py-12">{children}</div>
      </main>
    </div>
  );
}
