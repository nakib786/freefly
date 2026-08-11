import { Contact } from '@/components/Contact';
import { Footer } from '@/components/Footer';
import { Hero } from '@/components/Hero';
import { Instructors } from '@/components/Instructors';
import { Nav } from '@/components/Nav';
import { Plans } from '@/components/Plans';
import { Testimonials } from '@/components/Testimonials';
import { WhyTesla } from '@/components/WhyTesla';
import { PLACEHOLDERS } from '@/data/business';
import { useScrollReveals } from '@/lib/useScrollReveals';
import { SceneLayer } from '@/scene/SceneLayer';

export default function App() {
  useScrollReveals();

  if (import.meta.env.DEV) {
    console.info(
      `%cFree Fly — ${PLACEHOLDERS.length} placeholders outstanding`,
      'color:#cd1d4f;font-weight:bold',
    );
    for (const item of PLACEHOLDERS) console.info(`  • ${item}`);
  }

  return (
    <div className="grain relative">
      <a
        href="#lessons"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-crimson focus:px-4 focus:py-3 focus:text-cream"
      >
        Skip to lessons and pricing
      </a>

      {/* Fixed, behind everything, pointer-events: none. */}
      <SceneLayer />

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
  );
}
