/**
 * Reads lesson plans from /api/plans, falling back to the bundled data.
 *
 * Client-side rather than build-time on purpose: a price edit in the Wix
 * dashboard should reach the site without anyone triggering a redeploy, and
 * the fallback means there is no loading-shaped hole if the call is slow or the
 * key is not configured yet. The first paint shows real (if possibly stale)
 * prices immediately, then swaps in live data if it differs.
 */
import { useEffect, useState } from 'react';

import { FALLBACK_PLANS, mergeWithFallback, type LivePlan, type Plan } from '@/data/plans';

type ApiResponse = { configured: boolean; plans: LivePlan[] };

export type PlansState = {
  plans: readonly Plan[];
  /** True once a live response has been merged in. */
  live: boolean;
  /** Set when the endpoint is reachable but has no Wix credentials yet. */
  unconfigured: boolean;
};

const SESSION_KEY = 'freefly:plans:v1';

function readSession(): LivePlan[] | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LivePlan[]) : null;
  } catch {
    return null;
  }
}

export function usePlans(): PlansState {
  const [state, setState] = useState<PlansState>(() => {
    const cached = readSession();
    return cached?.length
      ? { plans: mergeWithFallback(cached), live: true, unconfigured: false }
      : { plans: FALLBACK_PLANS, live: false, unconfigured: false };
  });

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/plans', { signal: controller.signal });

        if (res.status === 503) {
          setState((s) => ({ ...s, unconfigured: true }));
          return;
        }
        if (!res.ok) return;

        const data = (await res.json()) as ApiResponse;
        if (!data.plans?.length) return;

        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(data.plans));
        } catch {
          // Private browsing / quota. Not worth failing the render over.
        }

        setState({ plans: mergeWithFallback(data.plans), live: true, unconfigured: false });
      } catch {
        // Offline, aborted, or the function isn't deployed (e.g. `vite dev`).
        // The fallback plans are already on screen; nothing to do.
      }
    })();

    return () => controller.abort();
  }, []);

  return state;
}
