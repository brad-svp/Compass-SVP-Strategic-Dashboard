import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Workflow, GraduationCap } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StaffGate } from '@/components/staff-gate';
import { AppShell } from '@/components/app-shell';
import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import { SignInPage, SignUpPage } from '@/pages/auth-pages';
import Dashboard from '@/pages/dashboard';
import SixBySix from '@/pages/six-by-six';
import Team from '@/pages/team';
import Settings from '@/pages/settings';
import Admin from '@/pages/admin';
import { PhasePreview } from '@/pages/phase-preview';
import Okrs from '@/pages/okrs';
import OkrDetail from '@/pages/okr-detail';
import { DevAuthProvider, useDevAuth } from '@/lib/dev-auth';

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsVariant: 'blockButton' as const,
  },
  variables: {
    colorPrimary: '#0A2540',
    colorForeground: '#0A2540',
    colorMutedForeground: '#3A4E63',
    colorDanger: '#B03E71',
    colorBackground: '#FBFAF6',
    colorInput: '#FFFFFF',
    colorInputForeground: '#0A2540',
    colorNeutral: '#0A2540',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#FBFAF6] rounded-2xl w-[420px] max-w-full overflow-hidden shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-serif text-2xl text-[#0A2540]',
    headerSubtitle: 'text-[#3A4E63]',
    socialButtonsBlockButtonText: 'text-[#0A2540] font-semibold',
    formFieldLabel: 'text-[#0A2540]',
    footerActionLink: 'text-[#1D8BC4] font-semibold',
    footerActionText: 'text-[#3A4E63]',
    dividerText: 'text-[#3A4E63]',
    identityPreviewEditButton: 'text-[#1D8BC4]',
    formFieldSuccessText: 'text-[#22702A]',
    alertText: 'text-[#0A2540]',
    logoBox: 'h-12',
    logoImage: 'h-12 w-12',
    socialButtonsBlockButton: 'h-12 border border-[#0A2540]/20 bg-white',
    formButtonPrimary: 'bg-[#0A2540] text-white',
    formFieldInput: 'border-[#0A2540]/20',
    footerAction: '',
    dividerLine: 'bg-[#0A2540]/15',
    alert: 'border border-[#B03E71]/30 bg-[#B03E71]/5',
    otpCodeFieldInput: 'border-[#0A2540]/20',
    formFieldRow: '',
    main: 'gap-5',
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) qc.clear();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function HomeRedirect() {
  const dev = useDevAuth();
  if (dev.loading) return null;
  if (dev.signedIn) return <Redirect to="/dashboard" />;
  return (
    <>
      <Show when="signed-in"><Redirect to="/dashboard" /></Show>
      <Show when="signed-out"><Landing /></Show>
    </>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const dev = useDevAuth();
  if (dev.loading) return null;
  if (dev.signedIn) return <StaffGate><AppShell>{children}</AppShell></StaffGate>;
  return (
    <>
      <Show when="signed-in">
        <StaffGate><AppShell>{children}</AppShell></StaffGate>
      </Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

const SystemsPreview = () => (
  <PhasePreview eyebrow="Systems" title="How the work gets done." icon={Workflow} color="#49B949"
    intro="The recurring processes the team relies on, documented with owners."
    items={[
      { title: 'Process library', body: 'Each recurring process written once, owned by one person.' },
      { title: 'Rhythm calendar', body: 'Meetings and cadences in one place.' },
    ]} />
);
const LearnPreview = () => (
  <PhasePreview eyebrow="Learn" title="Getting better on purpose." icon={GraduationCap} color="#ECA519"
    intro="Guides for working in SVP OS, plus what the team learns cycle to cycle."
    items={[
      { title: 'How we use OKRs', body: 'A short guide to writing good objectives.' },
      { title: 'Cycle retrospectives', body: 'What worked, what we changed.' },
    ]} />
);

function Routes() {
  const [location] = useLocation();
  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/dashboard"><Protected><Dashboard /></Protected></Route>
        <Route path="/okrs"><Protected><Okrs /></Protected></Route>
        <Route path="/okrs/:id"><Protected><OkrDetail /></Protected></Route>
        <Route path="/six-by-six"><Protected><SixBySix /></Protected></Route>
        <Route path="/team"><Protected><Team /></Protected></Route>
        <Route path="/systems"><Protected><SystemsPreview /></Protected></Route>
        <Route path="/learn"><Protected><LearnPreview /></Protected></Route>
        <Route path="/settings"><Protected><Settings /></Protected></Route>
        <Route path="/admin"><Protected><Admin /></Protected></Route>
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Sign in to SVP OS', subtitle: 'Continue with your SVP Google account' } },
        signUp: { start: { title: 'Sign in to SVP OS', subtitle: 'Continue with your SVP Google account' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <DevAuthProvider><Routes /></DevAuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
