/**
 * Reads lesson plans from /api/plans, falling back to the bundled data.
 *
 * Client-side rather than build-time on purpose: a price edit in the Wix
 * dashboard should reach the site without anyone triggering a redeploy, and
 * the fallback means there is no loading-shaped hole if the call is slow or the
 * key is not configured yet. The first paint shows real (if possibly stale)
 * prices immediately, then swaps in live data if it differs — on mount, and
 * again when the tab is re-focused after REFOCUS_REFRESH_MS.
 */
import { useEffect, useRef, useState } from 'react';

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

/**
 * Floor between refetches when the tab is re-focused. Editing a price in Wix
 * and switching back to the site is the exact moment someone wants to see the
 * new number, and making them reload to get it is what "not updating" felt
 * like. Long enough that tabbing back and forth is not a request per switch.
 */
const REFOCUS_REFRESH_MS = 30_000;

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

  const lastLoad = useRef(0);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      lastLoad.current = Date.now();
      try {
        // `no-store`: the endpoint already sends no-store, and the session copy
        // above covers the "instant first paint" case this would otherwise buy.
        // A browser cache here only ever serves a price we know is superseded.
        const res = await fetch('/api/plans', { cache: 'no-store', signal: controller.signal });

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
    };

    void load();

    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastLoad.current < REFOCUS_REFRESH_MS) return;
      void load();
    };

    document.addEventListener('visibilitychange', onFocus);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  return state;
}
