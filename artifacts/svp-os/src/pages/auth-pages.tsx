import { useState, type ReactNode } from 'react';
import { AuthenticateWithRedirectCallback, Show } from '@clerk/react';
import { useSignIn } from '@clerk/react/legacy';
import { Link, Redirect, useLocation } from 'wouter';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { BrandLockup, LogoMark } from '@/components/brand-logo';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const origin = window.location.origin;

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grain relative flex min-h-[100dvh] flex-col bg-[#0A2540]">
      <div className="pointer-events-none absolute -right-32 top-10 h-96 w-96 rounded-full bg-[#1D8BC4]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-[#B03E71]/20 blur-3xl" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center px-5 py-6">
        <Link href="/" data-testid="link-auth-home"><BrandLockup light /></Link>
      </header>
      <div className="relative flex flex-1 items-center justify-center px-4 pb-16">{children}</div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function clerkErrorMessage(err: unknown) {
  if (err && typeof err === 'object' && 'errors' in err) {
    const first = (err as { errors?: { longMessage?: string; message?: string }[] }).errors?.[0];
    if (first) return first.longMessage ?? first.message ?? 'Google sign-in could not start.';
  }
  return 'Google sign-in could not start. Please try again.';
}

function GoogleCard() {
  const { isLoaded, signIn } = useSignIn();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (!isLoaded || !signIn) return;
    setError(null);
    setPending(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${origin}${basePath}/sign-in/sso-callback`,
        redirectUrlComplete: `${origin}${basePath}/dashboard`,
      });
    } catch (e) {
      setError(clerkErrorMessage(e));
      setPending(false);
    }
  };

  return (
    <div className="rise w-[420px] max-w-full rounded-3xl bg-[#FBFAF6] p-8 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] md:p-10">
      <LogoMark className="h-12 w-12" />
      <h1 className="mt-6 font-display text-3xl font-semibold text-[#0A2540]">Sign in to SVP OS</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[#3A4E63]">
        The staff workspace for SVP Sacramento. Use your SVP Google Workspace account.
      </p>

      <button
        type="button"
        onClick={start}
        disabled={!isLoaded || pending}
        className="group mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#0A2540]/20 bg-white text-[15px] font-semibold text-[#0A2540] transition hover:border-[#1D8BC4] hover:bg-[#EAF4FA] active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
        data-testid="button-google-signin"
      >
        {!isLoaded || pending ? <Loader2 className="h-5 w-5 animate-spin text-[#1D8BC4]" /> : <GoogleGlyph />}
        {!isLoaded ? 'Preparing sign-in' : pending ? 'Redirecting to Google' : 'Continue with Google'}
        {isLoaded && !pending && <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />}
      </button>

      {error && (
        <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-[#B03E71]/30 bg-[#B03E71]/5 p-3 text-sm text-[#7A2A4E]" data-testid="text-signin-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="mt-8 border-t border-[#0A2540]/10 pt-5 text-[13px] leading-relaxed text-[#3A4E63]">
        Only active staff on the SVP list with a verified organization email can enter. Google is the only way in; there are no passwords here.
      </div>
    </div>
  );
}

function CallbackCard() {
  return (
    <div className="flex flex-col items-center gap-4 text-center" data-testid="status-sso-callback">
      <LogoMark className="h-14 w-14 animate-pulse" />
      <div className="font-display text-2xl text-[#F6F3EC]">Finishing sign-in</div>
      <p className="text-sm text-[#9FB3C8]">Confirming your Google account with SVP OS.</p>
      <AuthenticateWithRedirectCallback
        signInUrl={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        continueSignUpUrl={`${basePath}/sign-up/continue`}
        signInFallbackRedirectUrl={`${basePath}/dashboard`}
        signUpFallbackRedirectUrl={`${basePath}/dashboard`}
        transferable
      />
    </div>
  );
}

function ContinueCard() {
  return (
    <div className="rise w-[420px] max-w-full rounded-3xl bg-[#FBFAF6] p-8 md:p-10" data-testid="status-signup-incomplete">
      <h1 className="font-display text-2xl font-semibold text-[#0A2540]">We couldn't finish that sign-in</h1>
      <p className="mt-2 text-[15px] text-[#3A4E63]">Google didn't return everything SVP OS needs. Try again with your SVP Google Workspace account.</p>
      <Link href="/sign-in" className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#0A2540] px-5 text-sm font-semibold text-white" data-testid="link-retry-signin">Back to sign in</Link>
    </div>
  );
}

function AuthRoute() {
  const [location] = useLocation();
  const isCallback = location.endsWith('/sso-callback');
  const isContinue = location.endsWith('/continue');
  return (
    <AuthFrame>
      {isCallback ? <CallbackCard /> : (
        <>
          <Show when="signed-in"><Redirect to="/dashboard" /></Show>
          <Show when="signed-out">{isContinue ? <ContinueCard /> : <GoogleCard />}</Show>
        </>
      )}
    </AuthFrame>
  );
}

export const SignInPage = AuthRoute;
export const SignUpPage = AuthRoute;
