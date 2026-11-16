import { Link } from 'wouter';
import { ArrowRight, BarChart3, CalendarDays, Compass, Lock, Target, Users } from 'lucide-react';
import { BrandLockup } from '@/components/brand-logo';
import { COMMUNITY_PHOTOS, PUBLISHED_MISSION, PUBLISHED_VISION, PhotoFigure, PhotoLibraryLink, useDocumentTitle } from '@/components/home/community';

const TOOLS = [
  { icon: CalendarDays, color: '#006AB6', title: 'Master calendar', body: 'Program dates, events, and the year ahead.' },
  { icon: Target, color: '#1D8BC4', title: 'Quarterly QBOs', body: 'Company objectives, key results, and check-ins.' },
  { icon: CalendarDays, color: '#F99F39', title: 'The 6x6', body: 'Six weeks, six major moments, who carries what.' },
  { icon: BarChart3, color: '#49B949', title: 'Scorecard', body: 'Weekly measures against target.' },
  { icon: Users, color: '#B03E71', title: 'Team and ownership', body: 'Areas, roles, and seats written down plainly.' },
  { icon: Compass, color: '#006AB6', title: 'Purpose', body: 'Mission, vision, and the values we work by.' },
];

export default function Landing() {
  useDocumentTitle('SVP Compass · Staff sign in');
  const [lead, ...rest] = COMMUNITY_PHOTOS;

  return (
    <div className="min-h-[100dvh] bg-[#F6F3EC] text-[#0A2540]">
      <header className="border-b border-[#0A2540]/10 bg-[#FBFAF6]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <BrandLockup />
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-1.5 text-[12px] text-[#3A4E63] sm:inline-flex"><Lock className="h-3.5 w-3.5" /> Internal staff workspace</span>
            <Link href="/sign-in" data-testid="link-signin-header" className="inline-flex min-h-11 items-center rounded-lg border border-[#0A2540]/20 px-4 text-sm font-semibold transition-colors hover:bg-[#0A2540]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006AB6]">Staff sign in</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-10">
        <div className="space-y-6">
          <section className="rise motion-reduce:animate-none" aria-labelledby="welcome-heading">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#006AB6]">SVP Sacramento staff</div>
            <h1 id="welcome-heading" className="mt-2 font-display text-3xl font-semibold leading-tight md:text-[40px]">
              Welcome back. Our commitments, and the people they serve, in one place.
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#3A4E63]">
              SVP Compass is where our team keeps day-to-day work connected to the nonprofits and partners we show up for. Sign in to pick up where you left off.
            </p>
          </section>

          <section className="rise motion-reduce:animate-none grid gap-4 rounded-2xl border border-[#0A2540]/10 bg-[#FBFAF6] p-5 md:grid-cols-[1fr_1fr] md:p-6" style={{ animationDelay: '80ms' }} aria-labelledby="mission-heading">
            <div>
              <h2 id="mission-heading" className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#B8650C]">Our mission</h2>
              <p className="mt-2 font-display text-[19px] leading-snug" data-testid="text-mission">{PUBLISHED_MISSION}</p>
            </div>
            <div className="md:border-l md:border-[#0A2540]/10 md:pl-5">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#006AB6]">Our vision</h2>
              <p className="mt-2 font-display text-[19px] leading-snug" data-testid="text-vision">{PUBLISHED_VISION}</p>
              <ul className="mt-4 space-y-1 text-[13px] text-[#3A4E63]">
                {['Connect engaged philanthropists.', 'Strengthen local nonprofits.', 'Inspire greater generosity.'].map((t) => (
                  <li key={t} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#F99F39]" />{t}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rise motion-reduce:animate-none" style={{ animationDelay: '160ms' }} aria-labelledby="community-heading">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 id="community-heading" className="font-display text-lg font-semibold">From our programs</h2>
              <PhotoLibraryLink />
            </div>
            <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr] sm:grid-rows-2">
              <PhotoFigure photo={lead} className="aspect-[4/3] sm:row-span-2 sm:aspect-auto sm:min-h-[300px]" />
              {rest.map((p) => <PhotoFigure key={p.id} photo={p} className="aspect-[16/9]" />)}
            </div>
          </section>
        </div>

        <aside className="rise motion-reduce:animate-none space-y-4 lg:sticky lg:top-6 lg:self-start" style={{ animationDelay: '120ms' }}>
          <div className="rounded-2xl bg-[#0A2540] p-6 text-[#F6F3EC] shadow-[0_24px_50px_-30px_#0A2540]">
            <h2 className="font-display text-2xl font-semibold">Staff sign in</h2>
            <p className="mt-1 text-[13px] text-[#C9D6E3]">Use your SVP Sacramento Google account.</p>
            <Link href="/sign-in" className="group mt-5 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1D8BC4] text-[15px] font-semibold text-white outline-none transition-colors hover:bg-[#177AAE] focus-visible:ring-2 focus-visible:ring-[#F99F39] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A2540]" data-testid="link-signin-hero">
              Continue with Google
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
            </Link>
            <ol className="mt-5 space-y-2 border-t border-white/10 pt-4 text-[13px] text-[#C9D6E3]">
              {['Sign in with Google.', 'We check the active staff list an admin maintains.', 'You land on your dashboard.'].map((t, i) => (
                <li key={t} className="flex gap-2"><span className="font-mono text-[11px] text-[#F99F39]">0{i + 1}</span>{t}</li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-[#0A2540]/10 bg-[#FBFAF6] p-5">
            <h2 className="text-[13px] font-semibold">Inside, after sign in</h2>
            <ul className="mt-3 space-y-2.5">
              {TOOLS.map((t) => (
                <li key={t.title} className="flex gap-3" data-testid={`info-tool-${t.title.toLowerCase().replace(/\W+/g, '-')}`}>
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${t.color}1F`, color: t.color }}><t.icon className="h-4 w-4" /></span>
                  <div><div className="text-[13px] font-semibold">{t.title}</div><div className="text-[12px] text-[#3A4E63]">{t.body}</div></div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col justify-between gap-1 border-t border-[#0A2540]/10 px-5 py-5 text-[12px] text-[#3A4E63] md:flex-row md:px-8">
        <span>Social Venture Partners Sacramento · <a className="underline underline-offset-4" href={`${import.meta.env.BASE_URL}brand/brand-guide.html`}>SVP Compass brand guide</a></span>
        <span>Internal tool for SVP staff. Access limited to active staff accounts.</span>
      </footer>
    </div>
  );
}
