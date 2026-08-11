/**
 * Top bar.
 *
 * Deliberately not a floating pill with backdrop-blur — that treatment is the
 * single most recognisable "AI site" tell, and it would frost over the car the
 * whole page is built around. This is a flat hairline-ruled bar: wordmark left,
 * waypoint links centre-right, one solid call button. The only motion is a
 * progress rail along the bottom edge that fills as the drive advances, which
 * doubles as the scroll indicator.
 */
import { useEffect, useState } from 'react';

import { Wordmark } from '@/components/primitives';
import { BUSINESS } from '@/data/business';
import { KEYFRAMES } from '@/scene/keyframes';
import { timings } from '@/scene/timing';

const LINKS = [
  { href: '#why-tesla', label: 'Why Tesla' },
  { href: '#lessons', label: 'Lessons' },
  { href: '#instructors', label: 'Instructors' },
  { href: '#contact', label: 'Contact' },
];

export function Nav() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(window.scrollY / max, 1) : 0);
      raf = 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const scene = KEYFRAMES.reduce(
    (acc, kf, i) => (progress >= (timings[i] ?? kf.at) - 0.04 ? kf : acc),
    KEYFRAMES[0],
  );

  return (
    <header className="rule-b fixed inset-x-0 top-0 z-40 bg-ink-950/85">
      <div className="gutter flex h-16 items-center justify-between gap-6 md:h-20">
        <a href="#top" className="flex items-center gap-3 text-cream" aria-label={`${BUSINESS.name} — home`}>
          <Wordmark className="h-5 w-auto md:h-6" />
        </a>

        <nav aria-label="Sections" className="hidden items-center gap-8 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="type-telemetry text-cream-dim transition-colors hover:text-cream"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <span className="type-telemetry hidden text-cream-faint md:inline" aria-hidden>
            {scene.label}
          </span>
          <a
            href={BUSINESS.phoneHref}
            className="type-telemetry bg-crimson px-4 py-3 text-cream transition-colors hover:bg-crimson-bright"
          >
            Call {BUSINESS.phone}
          </a>
        </div>
      </div>

      {/* Drive progress. aria-hidden: it duplicates the scrollbar, and
          announcing a percentage on every scroll tick is noise. */}
      <div aria-hidden className="h-px w-full bg-ink-700">
        <div
          className="h-full bg-crimson"
          style={{ width: `${progress * 100}%`, transition: 'width 120ms linear' }}
        />
      </div>
    </header>
  );
}
