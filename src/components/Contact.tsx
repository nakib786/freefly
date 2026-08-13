/**
 * Contact.
 *
 * The form posts to /api/contact, a Pages Function in this same project that
 * mails the enquiry to the school via Cloudflare Email Routing. Same-origin, so
 * there is no CORS involved.
 *
 * The <form> keeps a real `action` and `method` pointing at the same endpoint,
 * so with JavaScript unavailable the browser performs a normal POST and the
 * enquiry still arrives. The fetch path only exists to keep the user on the
 * page and show inline status.
 */
import { useState } from 'react';

import { Readout, Scrim, Section } from '@/components/primitives';
import { BUSINESS, SOCIALS } from '@/data/business';

const FIELD =
  'w-full border border-ink-600 bg-ink-900/70 px-4 py-3 text-cream placeholder:text-ink-500 transition-colors focus:border-azure focus:outline-none';

/**
 * Each network's name is set in that network's own brand colour. The two
 * gradient marks (Instagram, TikTok) clip their gradient to the text, defined
 * in index.css. Written out as whole class strings rather than composed from
 * the label, because Tailwind's scanner only sees literals.
 */
const BRAND: Record<string, string> = {
  Instagram: 'brand-instagram',
  Facebook: 'brand-facebook',
  YouTube: 'brand-youtube',
  TikTok: 'brand-tiktok',
};

type Status =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'sent' }
  | { state: 'error'; message: string };

export function Contact() {
  const [status, setStatus] = useState<Status>({ state: 'idle' });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus({ state: 'sending' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setStatus({
          state: 'error',
          message: data.message ?? 'Something went wrong. Please call us instead.',
        });
        return;
      }

      form.reset();
      setStatus({ state: 'sent' });
    } catch {
      setStatus({
        state: 'error',
        message: 'Could not reach us. Check your connection, or call instead.',
      });
    }
  }

  return (
    <Section id="contact" index="05" eyebrow="Get started" className="pb-24 md:pb-32">
      <Scrim from="top" />

      <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-24">
        <div>
          <h2 className="reveal type-heading text-display max-w-[11ch] text-cream" data-reveal>
            Book your first lesson
          </h2>
          <p className="reveal type-condensed mt-8 max-w-[42ch] text-xl text-cream-dim" data-reveal>
            Call or message and we will match you to the right package, whether you have never sat
            behind a wheel or just need the car for your road test.
          </p>

          <div className="reveal mt-14 grid gap-10 sm:grid-cols-2" data-reveal>
            <Readout label="Phone" value={BUSINESS.phone} href={BUSINESS.phoneHref} />
            <Readout label="Email" value={BUSINESS.email} href={BUSINESS.emailHref} />
            <Readout
              label="Open"
              value={`${BUSINESS.hours.days} · ${BUSINESS.hours.opens}-${BUSINESS.hours.closes}`}
            />
            <Readout label="Cities" value={BUSINESS.cities.join(' · ')} />
            <Readout
              label="Based in"
              value={`${BUSINESS.address.street}, ${BUSINESS.address.city}`}
              href={`https://www.google.com/maps/search/${encodeURIComponent(
                `${BUSINESS.legalName} ${BUSINESS.address.street} ${BUSINESS.address.city} ${BUSINESS.address.region}`,
              )}`}
            />
            <Readout label="Service area" value={BUSINESS.region} />
          </div>

          <div className="reveal rule-t mt-12 pt-8" data-reveal>
            <p className="type-telemetry mb-5 text-cream-faint">Follow</p>
            <ul className="flex flex-wrap gap-x-8 gap-y-3">
              {SOCIALS.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-baseline gap-3"
                  >
                    <span
                      className={`type-heading text-lg transition-opacity group-hover:opacity-75 ${
                        BRAND[social.label] ?? 'text-cream'
                      }`}
                    >
                      {social.label}
                    </span>
                    <span className="type-telemetry text-cream-faint">{social.handle}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <form
          className="reveal flex flex-col gap-5 self-start border border-ink-700 bg-ink-950/60 p-6 md:p-8"
          data-reveal
          action="/api/contact"
          method="post"
          onSubmit={submit}
        >
          <p className="type-telemetry text-azure">Enquiry</p>

          {/* Honeypot. Hidden from sight and from screen readers, and taken out
              of the tab order, so no real user can fill it, but bots that
              blindly complete every input will, and the endpoint drops those. */}
          <div aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0">
            <label>
              Website
              <input name="website" type="text" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <label className="flex flex-col gap-2">
            <span className="type-telemetry text-cream-faint">Name</span>
            <input name="name" required autoComplete="name" className={FIELD} />
          </label>

          <label className="flex flex-col gap-2">
            <span className="type-telemetry text-cream-faint">Phone</span>
            <input name="phone" type="tel" autoComplete="tel" className={FIELD} />
          </label>

          <label className="flex flex-col gap-2">
            <span className="type-telemetry text-cream-faint">Email</span>
            <input name="email" type="email" autoComplete="email" className={FIELD} />
          </label>

          <label className="flex flex-col gap-2">
            <span className="type-telemetry text-cream-faint">Interested in</span>
            <select name="plan" className={FIELD} defaultValue="Not sure yet">
              {['Not sure yet', 'Individual Lesson', 'Beginners Plan', 'Intermediate Plan', 'Advanced Plan', 'Road Test Package'].map(
                (option) => (
                  <option key={option} value={option} className="bg-ink-900">
                    {option}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="type-telemetry text-cream-faint">Message</span>
            <textarea name="message" rows={4} className={`${FIELD} resize-y`} />
          </label>

          <button
            type="submit"
            disabled={status.state === 'sending'}
            className="type-telemetry bg-azure px-6 py-4 text-cream transition-colors hover:bg-azure-bright disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status.state === 'sending' ? 'Sending…' : 'Send enquiry'}
          </button>

          {/* aria-live so the outcome is announced, not just shown. */}
          <p
            className={`type-telemetry ${status.state === 'error' ? 'text-azure-bright' : 'text-cream-faint'}`}
            role="status"
            aria-live="polite"
          >
            {status.state === 'sent'
              ? `Sent. We'll be in touch. Need us sooner? Call ${BUSINESS.phone}.`
              : status.state === 'error'
                ? status.message
                : status.state === 'sending'
                  ? 'Sending your enquiry…'
                  : 'Goes straight to the school. Or call us directly.'}
          </p>
        </form>
      </div>
    </Section>
  );
}
