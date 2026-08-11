/**
 * Consent gate in front of the raw model.
 *
 * The rule this enforces is simple: until somebody presses the button, this
 * page costs the same as any other page of text. No GLB, no three.js, no
 * decoder — the viewer is behind a dynamic import, so the network sees nothing
 * until a person has read the size and chosen to pay it.
 *
 * That is also why the button carries the number. "View 3D model" with a 21.6 MB
 * download behind it is the pattern this page exists to avoid; a metered
 * connection should be able to decide before, not during.
 */
import { lazy, Suspense, useEffect, useState } from 'react';

import { mb, MODEL_BUILDS, RAW_MODEL } from '@/data/credits';
import { detectCapability } from '@/lib/capability';

const RawModelViewer = lazy(() => import('@/credits/RawModelViewer'));

type Readiness = {
  /** No usable WebGL — the button would only ever produce a black rectangle. */
  webgl: boolean;
  /** Underpowered device: it will probably load, and it will probably crawl. */
  heavy: boolean;
  reducedMotion: boolean;
  /** The user has asked the browser for less data. Worth saying out loud. */
  saveData: boolean;
};

function readiness(): Readiness {
  const capability = detectCapability();
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;

  return {
    webgl: capability.tier !== 'none',
    heavy: capability.tier === 'lite',
    reducedMotion: capability.reducedMotion,
    saveData: connection?.saveData === true,
  };
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="type-telemetry text-cream-faint">{label}</dt>
      <dd className="font-display text-lg tracking-tight text-cream md:text-xl">{value}</dd>
    </div>
  );
}

export function RawModelGate() {
  const [state, setState] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(false);

  // Probing touches WebGL and navigator, so it waits for the client.
  useEffect(() => setState(readiness()), []);

  if (loading) {
    return (
      <Suspense
        fallback={
          <div className="grid aspect-[4/3] w-full place-items-center bg-ink-900 md:aspect-[16/10]">
            <p className="type-telemetry text-cream-faint">Starting renderer</p>
          </div>
        }
      >
        <RawModelViewer reducedMotion={state?.reducedMotion ?? false} />
      </Suspense>
    );
  }

  return (
    <div className="rule-t border-r border-b border-l border-ink-700 bg-ink-950/60">
      <div className="rule-b flex items-baseline justify-between gap-4 px-5 py-3.5">
        <p className="type-telemetry text-cream-faint">Source asset · not loaded</p>
        <p className="type-telemetry text-azure-bright">{mb(RAW_MODEL.bytes)}</p>
      </div>

      <div className="flex flex-col gap-8 p-5 md:p-7">
        {/* Copy and readout share the row: the panel is full-bleed, and a
            paragraph alone in the left quarter of it looks like a mistake. */}
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <p className="type-condensed text-lg text-cream-dim md:text-xl">
            The original file is {mb(RAW_MODEL.bytes)} — roughly fifteen times what the car on the
            homepage weighs, and it has to be decoded before anything appears. It is here so the
            licence can be checked against the real asset, not because the page needs it.
          </p>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-7">
            <Spec label="Transfer" value={mb(RAW_MODEL.bytes)} />
            <Spec label="Triangles" value={RAW_MODEL.tris.toLocaleString()} />
            <Spec label="Meshes" value={String(RAW_MODEL.meshes)} />
            <Spec label="Materials" value={String(RAW_MODEL.materials)} />
          </dl>
        </div>

        {state && !state.webgl ? (
          <p className="max-w-[62ch] border border-ink-700 px-4 py-3.5 text-sm text-cream-dim">
            This browser has no usable WebGL, so the model cannot be shown here. The file itself is
            at{' '}
            <a
              href={RAW_MODEL.url}
              className="break-all text-cream underline underline-offset-4 hover:text-azure-bright"
            >
              {RAW_MODEL.url}
            </a>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setLoading(true)}
              disabled={!state}
              className="type-telemetry self-start bg-azure px-6 py-4 text-cream transition-colors hover:bg-azure-bright disabled:cursor-not-allowed disabled:opacity-60"
            >
              Load the raw model · {mb(RAW_MODEL.bytes)}
            </button>

            <p className="type-telemetry text-cream-faint">
              {state?.saveData
                ? 'Your browser is in data-saver mode — this will use about 22 MB.'
                : state?.heavy
                  ? 'This device looks low-powered; expect a slow load and a low frame rate.'
                  : 'Nothing downloads until you press this.'}
            </p>
          </div>
        )}

        <table className="w-full border-collapse text-left">
          <caption className="type-telemetry pb-3 text-left text-cream-faint">
            What the site actually ships
          </caption>
          <tbody>
            {MODEL_BUILDS.map((build) => (
              <tr key={build.label} className="rule-t">
                <th scope="row" className="py-3 pr-4 text-sm font-normal text-cream-dim">
                  {build.label}
                </th>
                <td className="type-telemetry py-3 pr-4 text-cream-faint">
                  {build.tris.toLocaleString()} tris
                </td>
                <td className="type-telemetry py-3 text-right text-cream-dim">{mb(build.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
