import { useWorkspaceSignOut } from '@/lib/dev-auth';
import { Link } from 'wouter';
import { LockKeyhole, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLockup } from '@/components/brand-logo';

export function AccessDenied({ status, inline = false }: { status?: number; inline?: boolean }) {
  const signOut = useWorkspaceSignOut();
  const isAuth = status === 401;
  const body = (
    <div className="rise mx-auto max-w-lg rounded-3xl border border-card-border bg-card p-8 text-center md:p-10">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#B03E71]/10 text-[#B03E71]">
        <LockKeyhole className="h-6 w-6" />
      </div>
      <h1 className="font-display text-3xl font-semibold text-[#0A2540]" data-testid="text-access-denied">
        {inline ? 'Admins only' : isAuth ? 'Your session needs a refresh' : 'This account is not on the SVP staff list'}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        {inline
          ? 'This space is for SVP Compass administrators. Ask an admin if you need a change to staff, areas, or cycles.'
          : isAuth
            ? 'We could not confirm your sign-in. Sign out and sign back in with your SVP Google account.'
            : 'SVP Compass is open to active SVP Sacramento staff signing in with their work Google account. If you think this is a mistake, ask an admin to add your email.'}
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {inline ? (
          <Link href="/dashboard" className="inline-flex h-10 items-center rounded-lg bg-[#0A2540] px-4 text-sm font-semibold text-white" data-testid="link-back-dashboard">
            Back to dashboard
          </Link>
        ) : (
          <Button onClick={() => signOut()} className="bg-[#0A2540] text-white" data-testid="button-signout-denied">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        )}
      </div>
    </div>
  );
  if (inline) return body;
  return (
    <div className="grain flex min-h-[100dvh] flex-col items-center justify-center gap-10 bg-background px-4">
      <BrandLockup />
      {body}
    </div>
  );
}
