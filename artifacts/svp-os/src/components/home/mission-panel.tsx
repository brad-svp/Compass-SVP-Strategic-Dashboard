import { Link } from 'wouter';
import { ArrowUpRight, RotateCw } from 'lucide-react';
import { useGetSvpPurpose } from '@workspace/api-client-react';
import { COMMUNITY_PHOTOS, PhotoFigure, PhotoLibraryLink } from './community';

export function MissionPanel() {
  const purpose = useGetSvpPurpose();
  const mission = purpose.data?.mission.trim() ?? '';
  const vision = purpose.data?.vision.trim() ?? '';
  const values = purpose.data?.values ?? [];

  return (
    <section aria-labelledby="mission-heading" className="rise motion-reduce:animate-none mb-5 overflow-hidden rounded-2xl border border-[#0A2540]/10 bg-[#0A2540] text-[#F6F3EC]" data-testid="panel-mission">
      <div className="grid lg:grid-cols-[1.25fr_1fr]">
        <div className="relative p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="mission-heading" className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#F99F39]">Why the work matters</h2>
            <Link href="/purpose" className="group inline-flex items-center gap-1 rounded text-[12px] font-semibold text-[#8FC6E4] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-[#8FC6E4]" data-testid="link-purpose">
              Mission and values <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          </div>

          {purpose.isLoading ? (
            <div className="mt-4 space-y-2" aria-label="Loading mission" data-testid="status-mission-loading">
              <div className="h-5 w-11/12 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
              <div className="h-5 w-4/5 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
              <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
            </div>
          ) : purpose.isError ? (
            <div className="mt-4 rounded-lg border border-[#F99F39]/40 bg-[#F99F39]/10 p-3 text-[13px]" role="status" data-testid="status-mission-error">
              Mission statements could not load. The rest of your dashboard is unaffected.
              <button type="button" onClick={() => purpose.refetch()} className="ml-2 inline-flex items-center gap-1 rounded font-semibold text-[#F99F39] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-[#F99F39]" data-testid="button-mission-retry">
                <RotateCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          ) : !mission && !vision && values.length === 0 ? (
            <p className="mt-4 text-[14px] text-[#C9D6E3]" data-testid="status-mission-empty">
              No mission or vision has been written yet. {purpose.data?.canEdit ? 'Add them on the Purpose page.' : 'An admin can add them on the Purpose page.'}
            </p>
          ) : (
            <>
              {mission && <p className="mt-3 font-display text-[19px] leading-snug text-white md:text-[21px]" data-testid="text-mission">{mission}</p>}
              {vision && (
                <p className="mt-3 border-l-2 border-[#1D8BC4] pl-3 text-[14px] text-[#C9D6E3]" data-testid="text-vision">
                  <span className="mr-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#8FC6E4]">Vision</span>{vision}
                </p>
              )}
              {values.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Values">
                  {values.slice(0, 6).map((v) => (
                    <li key={v.id} className="rounded-full border border-white/15 px-2.5 py-0.5 text-[12px] text-[#E6EDF3]" data-testid={`value-${v.id}`}>{v.title}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          <div className="mt-4 text-[12px] text-[#9FB3C8]">Connect engaged philanthropists. Strengthen local nonprofits. Inspire greater generosity.</div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-1.5 lg:grid-cols-2 lg:grid-rows-2">
          {COMMUNITY_PHOTOS.map((p, i) => (
            <PhotoFigure key={p.id} photo={p} compact className={`aspect-[4/3] lg:aspect-auto ${i === 0 ? 'lg:row-span-2' : ''}`} />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end border-t border-white/10 px-5 py-2">
        <PhotoLibraryLink light />
      </div>
    </section>
  );
}
