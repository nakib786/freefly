import { useState } from 'react';

import { Boot } from '@/components/Boot';
import { Contact } from '@/components/Contact';
import { Footer } from '@/components/Footer';
import { Hero } from '@/components/Hero';
import { Instructors } from '@/components/Instructors';
import { Nav } from '@/components/Nav';
import { Plans } from '@/components/Plans';
import { Testimonials } from '@/components/Testimonials';
import { WhyTesla } from '@/components/WhyTesla';
import { PLACEHOLDERS } from '@/data/business';
import { useBootSequence } from '@/lib/useBootSequence';
import { useScrollReveals } from '@/lib/useScrollReveals';
import { SceneLayer } from '@/scene/SceneLayer';

export default function App() {
  useScrollReveals();

  // The page renders underneath the boot screen rather than after it: the point
  // of the gate is to get the document laid out, the fonts resolved and the car
  // decoded *while* it is up, so lifting it reveals a page that is already
  // settled. `inert` keeps that hidden page out of the tab order meanwhile.
  const boot = useBootSequence();
  const [gated, setGated] = useState(true);

  if (import.meta.env.DEV) {
    console.info(
      `%cFree Fly: ${PLACEHOLDERS.length} placeholders outstanding`,
      'color:#1a72d6;font-weight:bold',
    );
    for (const item of PLACEHOLDERS) console.info(`  • ${item}`);
  }

  return (
    <>
      {gated && <Boot {...boot} onDismissed={() => setGated(false)} />}

      <div className="grain relative" inert={gated}>
        <a
          href="#lessons"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-azure focus:px-4 focus:py-3 focus:text-cream"
        >
          Skip to lessons and pricing
        </a>

        {/* Fixed, behind everything, pointer-events: none. */}
        <SceneLayer hold={boot.holdScene} />

        <Nav />

        <main>
          <Hero />
          <WhyTesla />
          <Plans />
          <Instructors />
          <Testimonials />
          <Contact />
        </main>

        <Footer />
      </div>
    </>
  );
}
