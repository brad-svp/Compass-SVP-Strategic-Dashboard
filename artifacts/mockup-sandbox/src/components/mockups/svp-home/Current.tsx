import type { AnchorHTMLAttributes } from 'react';
import './_group.css';
function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) { return <a {...props} onClick={(e) => e.preventDefault()} />; }
import { ArrowRight, Compass, Grid3x3, Users } from 'lucide-react';
import { BrandLockup } from './_BrandLogo';

const PILLARS = [
  { icon: Compass, color: '#1D8BC4', title: 'One set of priorities', body: 'Company objectives and key results the whole team can see, own, and check in on.' },
  { icon: Grid3x3, color: '#49B949', title: 'The 6x6 rhythm', body: 'Six weeks, six major moments, one shared view of who carries what.' },
  { icon: Users, color: '#ECA519', title: 'Clear ownership', body: 'Every area and every role, written down plainly so nothing falls between desks.' },
];

export function Current() {
  return (
    <div className="grain relative min-h-[100dvh] overflow-hidden bg-[#0A2540] text-[#F6F3EC]">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#1D8BC4]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-52 -left-32 h-[440px] w-[440px] rounded-full bg-[#B03E71]/20 blur-3xl" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6 md:px-10">
        <BrandLockup light />
        <Link href="/sign-in" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10" data-testid="link-signin-header">
          Staff sign in
        </Link>
      </header>

      <main className="relative mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-10 md:grid-cols-[1.25fr_1fr] md:px-10 md:pt-20">
        <section>
          <div className="rise mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8FC6E4]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#49B949]" /> Staff workspace
          </div>
          <h1 className="rise font-display text-5xl font-semibold leading-[1.02] md:text-7xl" style={{ animationDelay: '80ms' }}>
            Where SVP Sacramento <em className="font-normal italic text-[#5FB6E3]">plans the work</em> that moves the region.
          </h1>
          <p className="rise mt-6 max-w-xl text-lg leading-relaxed text-[#C9D6E3]" style={{ animationDelay: '160ms' }}>
            SVP OS is our team's operating system: priorities, rhythm, and ownership in one calm place. It's for the six of us, signed in with our SVP Google accounts.
          </p>
          <div className="rise mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: '240ms' }}>
            <Link href="/sign-in" className="group inline-flex h-12 items-center gap-2 rounded-xl bg-[#1D8BC4] px-6 text-[15px] font-semibold text-white shadow-[0_12px_30px_-12px_#1D8BC4] transition hover:bg-[#1A7DB0]" data-testid="link-signin-hero">
              Continue with Google
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <span className="text-sm text-[#9FB3C8]">Access is limited to SVP staff accounts.</span>
          </div>
        </section>

        <section className="rise relative self-center" style={{ animationDelay: '300ms' }} aria-label="What SVP OS holds">
          <div className="grid grid-cols-6 gap-1.5 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            {Array.from({ length: 36 }).map((_, i) => {
              const palette = ['#1D8BC4', '#49B949', '#ECA519', '#B03E71'];
              const lit = [2, 7, 9, 14, 16, 21, 23, 28, 30, 33].includes(i);
              return (
                <div
                  key={i}
                  className="aspect-square rounded-md transition-transform duration-300 hover:scale-110"
                  style={{ background: lit ? palette[i % 4] : 'rgba(255,255,255,0.06)' }}
                />
              );
            })}
          </div>
          <div className="mt-4 text-center text-[12px] uppercase tracking-[0.2em] text-[#9FB3C8]">Six weeks. Six moments. One team.</div>
        </section>
      </main>

      <section className="relative border-t border-white/10 bg-[#081E35]">
        <div className="mx-auto grid max-w-6xl gap-px px-5 py-14 md:grid-cols-3 md:px-10">
          {PILLARS.map((p) => (
            <div key={p.title} className="group p-4 md:p-6">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl transition-transform group-hover:-translate-y-1" style={{ background: `${p.color}26`, color: p.color }}>
                <p.icon className="h-5 w-5" />
              </div>
              <h2 className="font-display text-xl font-semibold text-white">{p.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[#C9D6E3]">{p.body}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-14 md:px-10">
          <div className="grid gap-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:grid-cols-[1fr_2fr] md:p-10">
            <h2 className="font-display text-3xl font-semibold text-white">How access works</h2>
            <ol className="grid gap-5 sm:grid-cols-3">
              {[
                ['Sign in with Google', 'Use the SVP Sacramento Google account you already work in.'],
                ['We check the staff list', 'Only active teammates an admin has added can enter.'],
                ['Land on your dashboard', 'Cycle, rhythm and ownership, ready where you left them.'],
              ].map(([t, b], i) => (
                <li key={t}>
                  <div className="font-mono text-[12px] text-[#ECA519]">0{i + 1}</div>
                  <div className="mt-1 font-semibold text-white">{t}</div>
                  <p className="mt-1 text-[14px] leading-relaxed text-[#C9D6E3]">{b}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <footer className="mx-auto flex max-w-6xl flex-col justify-between gap-2 px-5 pb-10 text-[13px] text-[#9FB3C8] md:flex-row md:px-10">
          <span>Social Venture Partners Sacramento</span>
          <span>Internal tool. Not a public service.</span>
        </footer>
      </section>
    </div>
  );
}
