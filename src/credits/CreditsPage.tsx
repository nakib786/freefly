/**
 * /credits — attribution, licences, and the raw car behind a consent gate.
 *
 * Its own document rather than a route on the homepage, for two reasons: the
 * homepage has no router, and more importantly this page's whole argument is
 * that heavy things should be opt-in. Bolting it onto the main bundle would
 * have made the credits page cost the visitor who never opens it.
 *
 * Layout note: this deliberately does not reuse the homepage's `Section`, which
 * carries `reveal` and depends on GSAP being loaded to un-hide itself. Pulling
 * an animation library in so a static list of licences can fade would be a poor
 * trade on a page that exists to argue the opposite.
 */
import type { ReactNode } from 'react';

import { Wordmark } from '@/components/primitives';
import { RawModelGate } from '@/credits/RawModelGate';
import { BUSINESS } from '@/data/business';
import {
  CODE_CREDITS,
  DEVELOPER,
  MODEL,
  MODEL_CHANGES,
  TYPE_CREDITS,
} from '@/data/credits';

type Credit = {
  name: string;
  by: string;
  licence: string;
  href: string;
  note?: string;
};

/** One band of the page. The number in the rail is what makes this a route
 *  sheet rather than a stack of centred blocks. */
function Band({
  index,
  eyebrow,
  children,
}: {
  index: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section className="rule-t gutter">
      <div className="mx-auto max-w-[110rem] py-12 md:py-16">
        <header className="mb-10 flex items-baseline gap-4 md:mb-14">
          <span className="type-telemetry text-azure">{index}</span>
          <h2 className="type-telemetry text-cream-faint">{eyebrow}</h2>
        </header>
        {children}
      </div>
    </section>
  );
}

/** A manifest row: what it is, who made it, what it is used under. */
function CreditRow({ credit }: { credit: Credit }) {
  return (
    <li className="rule-t grid grid-cols-1 gap-1 py-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_auto] md:items-baseline md:gap-8">
      <a
        href={credit.href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-display text-lg tracking-tight text-cream transition-colors hover:text-azure-bright md:text-xl"
      >
        {credit.name}
      </a>
      <p className="type-telemetry text-cream-faint">
        {credit.by}
        {credit.note ? <span className="text-cream-faint/70"> · {credit.note}</span> : null}
      </p>
      <p className="type-telemetry text-cream-dim md:text-right">{credit.licence}</p>
    </li>
  );
}

export function CreditsPage() {
  return (
    <div className="grain min-h-dvh bg-ink-950">
      <header className="rule-b gutter">
        <div className="mx-auto flex max-w-[110rem] items-center justify-between gap-6 py-5">
          <a href="/" aria-label={`${BUSINESS.name} home`}>
            <Wordmark className="h-7 w-auto text-cream md:h-8" />
          </a>
          <a href="/" className="type-telemetry text-cream-dim hover:text-azure-bright">
            ← Back to the site
          </a>
        </div>
      </header>

      <main>
        <div className="gutter">
          <div className="mx-auto max-w-[110rem] pt-16 pb-4 md:pt-24 md:pb-10">
            <p className="type-telemetry mb-6 text-azure">Credits &amp; licences</p>
            <h1 className="type-display max-w-[14ch] text-display text-cream">
              Everything we didn&rsquo;t make
            </h1>
            <p className="type-condensed mt-8 max-w-[52ch] text-xl text-cream-dim md:text-2xl">
              The car in the background is somebody else&rsquo;s work, used under a licence that
              asks for credit. So are the typefaces and most of the code. This is the list, and the
              original car is at the bottom of it — if you ask for it.
            </p>
          </div>
        </div>

        <Band index="01" eyebrow="The car">
          <div className="grid gap-x-8 gap-y-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <p className="type-telemetry mb-3 text-cream-faint">Work</p>
              <p className="font-display text-2xl tracking-tight text-cream md:text-3xl">
                <a
                  href={MODEL.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-ink-500 underline-offset-[6px] transition-colors hover:text-azure-bright hover:decoration-azure"
                >
                  &ldquo;{MODEL.title}&rdquo;
                </a>
              </p>
              <p className="type-condensed mt-4 max-w-[40ch] text-lg text-cream-dim">
                by {MODEL.author}, published on Sketchfab and used here under the{' '}
                <a
                  href={MODEL.licenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cream underline underline-offset-4 hover:text-azure-bright"
                >
                  {MODEL.licence}
                </a>{' '}
                licence. It has been modified.
              </p>

              <dl className="mt-10 grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5">
                  <dt className="type-telemetry text-cream-faint">Author</dt>
                  <dd className="text-cream">{MODEL.author}</dd>
                </div>
                <div className="flex flex-col gap-1.5">
                  <dt className="type-telemetry text-cream-faint">Licence</dt>
                  <dd className="text-cream">{MODEL.licenceShort}</dd>
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <dt className="type-telemetry text-cream-faint">Source</dt>
                  <dd>
                    <a
                      href={MODEL.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm break-all text-cream-dim underline underline-offset-4 hover:text-azure-bright"
                    >
                      {MODEL.source}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <p className="type-telemetry mb-3 text-cream-faint">
                Changes made to the original
              </p>
              <ol className="mt-2">
                {MODEL_CHANGES.map((change, i) => (
                  <li key={change} className="rule-t flex gap-5 py-4">
                    <span className="type-telemetry shrink-0 text-azure">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm text-cream-dim">{change}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-16">
            <RawModelGate />
          </div>
        </Band>

        <Band index="02" eyebrow="Type">
          <ul>
            {TYPE_CREDITS.map((credit) => (
              <CreditRow
                key={credit.name}
                credit={{ ...credit, note: credit.use }}
              />
            ))}
          </ul>
        </Band>

        <Band index="03" eyebrow="Code">
          <ul>
            {CODE_CREDITS.map((credit) => (
              <CreditRow key={credit.name} credit={credit} />
            ))}
          </ul>
        </Band>

        <Band index="04" eyebrow="The build">
          <div className="flex flex-col gap-6">
            <a
              href={DEVELOPER.href}
              target="_blank"
              rel="noopener noreferrer"
              className="type-heading max-w-[16ch] text-display-sm text-cream transition-colors hover:text-azure-bright"
            >
              {DEVELOPER.name}
            </a>
            <p className="type-telemetry text-cream-faint">{DEVELOPER.role}</p>
          </div>
        </Band>
      </main>

      <footer className="rule-t gutter">
        <div className="mx-auto flex max-w-[110rem] flex-col gap-3 py-8 md:flex-row md:items-center md:justify-between">
          <p className="type-telemetry text-cream-faint">
            © {new Date().getFullYear()} {BUSINESS.legalName}
          </p>
          <a href="/" className="type-telemetry text-cream-dim hover:text-azure-bright">
            ← Back to the site
          </a>
        </div>
      </footer>
    </div>
  );
}
