/**
 * Footer. Carries the CC-BY attribution the 3D model's licence requires.
 */
import { Wordmark } from '@/components/primitives';
import { BUSINESS, SOCIALS } from '@/data/business';

const MODEL_CREDIT = {
  title: 'Tesla 2018 Model 3',
  author: 'Ameer Studio',
  source: 'https://sketchfab.com/3d-models/tesla-2018-model-3-5ef9b845aaf44203b6d04e2c677e444f',
  licence: 'CC Attribution',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

/**
 * The camera's last keyframe parks the car centred and low, directly behind
 * this footer — so a solid plate here blacks out the one framing the whole
 * scroll has been driving toward. The footer gets a scrim instead, like every
 * section above it: clear enough at the top for the parked car and its
 * headlights to read, firming up under the smallest legal type.
 *
 * It opens at 0.32 rather than 0 because Contact's `top` scrim leaves off at
 * 0.35 — starting from nothing would put the page's clearest band at the seam
 * and make the join look like a rendering fault instead of a fade.
 */
const FOOTER_SCRIM =
  'linear-gradient(to bottom, rgba(6,8,9,0.32) 0%, rgba(6,8,9,0.62) 22%, rgba(6,8,9,0.86) 50%, rgba(6,8,9,0.93) 100%)';

export function Footer() {
  return (
    <footer className="rule-t gutter relative pt-16 pb-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: FOOTER_SCRIM }}
      />
      <div className="mx-auto max-w-[110rem]">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-20">
          <div>
            <Wordmark className="h-8 w-auto text-cream md:h-10" />
            <p className="type-condensed mt-6 max-w-[34ch] text-base text-cream-dim">
              {BUSINESS.legalName} — {BUSINESS.licenceClasses.join(' & ')} driving lessons in a
              Tesla Model 3 across the {BUSINESS.region}.
            </p>
          </div>

          <div className="flex flex-col gap-8 sm:flex-row sm:gap-16">
            <div>
              <p className="type-telemetry mb-4 text-cream-faint">Contact</p>
              <ul className="flex flex-col gap-2 text-sm">
                <li>
                  <a href={BUSINESS.phoneHref} className="text-cream hover:text-azure-bright">
                    {BUSINESS.phone}
                  </a>
                </li>
                <li>
                  <a href={BUSINESS.emailHref} className="text-cream hover:text-azure-bright">
                    {BUSINESS.email}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="type-telemetry mb-4 text-cream-faint">Follow</p>
              <ul className="flex flex-col gap-2 text-sm">
                {SOCIALS.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cream hover:text-azure-bright"
                    >
                      {social.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="rule-t mt-14 flex flex-col gap-4 pt-8 md:flex-row md:items-center md:justify-between">
          <p className="type-telemetry text-cream-faint">
            © {new Date().getFullYear()} {BUSINESS.legalName}
          </p>

          {/* CC-BY requires attribution wherever the work is used. */}
          <p className="type-telemetry text-cream-faint">
            3D model{' '}
            <a
              href={MODEL_CREDIT.source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cream-dim underline underline-offset-4 hover:text-azure-bright"
            >
              &ldquo;{MODEL_CREDIT.title}&rdquo;
            </a>{' '}
            by {MODEL_CREDIT.author}, licensed{' '}
            <a
              href={MODEL_CREDIT.licenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cream-dim underline underline-offset-4 hover:text-azure-bright"
            >
              {MODEL_CREDIT.licence}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
