import { useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';

export const PHOTO_LIBRARY = 'https://photos.svpsacramento.org/';
const base = import.meta.env.BASE_URL;

export const PUBLISHED_MISSION = 'We unite the collective power of nonprofits and philanthropic changemakers to accelerate community impact in the Greater Sacramento region.';
export const PUBLISHED_VISION = 'A thriving Sacramento region where everyone can reach their potential.';

export const COMMUNITY_PHOTOS = [
  { id: 'think-tank', src: `${base}images/community/think-tank.webp`, program: 'Think Tanks', alt: 'Partners seated at round tables listening to two speakers during a Think Tank session', caption: 'Partners working a problem together at a Think Tank.' },
  { id: 'fast-pitch', src: `${base}images/community/fast-pitch.webp`, program: 'Fast Pitch', alt: 'A nonprofit leader speaking on stage in front of a projected screen at Fast Pitch', caption: 'A nonprofit leader making the case on the Fast Pitch stage.' },
  { id: '100x', src: `${base}images/community/100x.webp`, program: '100x', alt: 'Large white SVP letters with an Amplify Your Impact sign set up in a 100x gathering venue', caption: 'The SVP letters, set up before a 100x gathering.' },
];

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
}

export function PhotoLibraryLink({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <a href={PHOTO_LIBRARY} target="_blank" rel="noopener noreferrer" data-testid="link-photo-library"
      className={`group inline-flex items-center gap-1 rounded text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#1D8BC4] focus-visible:ring-offset-2 ${light ? 'text-[#8FC6E4] hover:text-white' : 'text-[#006AB6] hover:text-[#0A2540]'} ${className ?? ''}`}>
      SVP photo library
      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </a>
  );
}

export function PhotoFigure({ photo, className, imgClass, compact = false }: { photo: typeof COMMUNITY_PHOTOS[number]; className?: string; imgClass?: string; compact?: boolean }) {
  return (
    <figure className={`group relative overflow-hidden rounded-xl bg-[#0A2540] ${className ?? ''}`} data-testid={`img-community-${photo.id}`}>
      <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async"
        className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${imgClass ?? ''}`} />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0A2540]/90 via-[#0A2540]/50 to-transparent px-3 pb-2.5 pt-8 text-[12px] leading-snug text-[#F6F3EC]">
        <span className="mr-1.5 rounded bg-[#F99F39] px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-[#1D2835]">{photo.program}</span>
        <span className={compact ? 'hidden sm:inline' : undefined}>{photo.caption}</span>
      </figcaption>
    </figure>
  );
}
