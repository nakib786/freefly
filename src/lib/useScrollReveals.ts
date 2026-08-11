/**
 * Section-entry reveals for anything marked `data-reveal`.
 *
 * Uses IntersectionObserver rather than GSAP ScrollTrigger, deliberately.
 * ScrollTrigger drives the camera (that is the job it is genuinely needed for —
 * scrubbing a timeline against scroll position), but for "has this entered the
 * viewport yet" it was the wrong tool here on three counts:
 *
 *   - it polls inside a rAF loop, so it silently stops updating in a
 *     backgrounded or non-compositing tab and elements never reveal;
 *   - it measures trigger positions once, so a layout shift after web fonts
 *     load leaves the stored start positions stale;
 *   - it only knows about the nodes that existed when batch() was called, so
 *     anything rendered later (the plans section re-rendering with live Wix
 *     data) stays invisible forever.
 *
 * IntersectionObserver has none of those problems: it is driven by the browser's
 * own layout, fires for elements already on screen at observe() time, and costs
 * nothing when idle. The MutationObserver below picks up nodes added after
 * mount, which is what makes the live-data re-render safe.
 *
 * The CSS does the animating (see `@utility reveal`); this only flips
 * `data-shown`. If the hook never runs at all, the reduced-motion block in
 * index.css still forces content visible rather than leaving it at opacity 0.
 */
import { useEffect } from 'react';

/** Reveal once the element's top edge is this far into the viewport. */
const ROOT_MARGIN = '0px 0px -8% 0px';

export function useScrollReveals(enabled = true) {
  useEffect(() => {
    const reveal = (node: HTMLElement, delay = 0) => {
      if (delay <= 0) {
        node.dataset.shown = 'true';
        return;
      }
      window.setTimeout(() => {
        node.dataset.shown = 'true';
      }, delay);
    };

    const showAll = () => {
      for (const node of document.querySelectorAll<HTMLElement>('[data-reveal]')) reveal(node);
    };

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!enabled || reduced || typeof IntersectionObserver === 'undefined') {
      showAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Stagger within a batch that lands together, so a section's rows
        // cascade rather than all snapping at once. Sorted by position so the
        // cascade runs down the page regardless of callback order.
        const entering = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        entering.forEach((entry, i) => {
          const node = entry.target as HTMLElement;
          observer.unobserve(node);
          reveal(node, Math.min(i, 6) * 80);
        });
      },
      { rootMargin: ROOT_MARGIN, threshold: 0 },
    );

    const observed = new WeakSet<Element>();
    const scan = () => {
      for (const node of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
        if (node.dataset.shown === 'true' || observed.has(node)) continue;
        observed.add(node);
        observer.observe(node);
      }
    };

    scan();

    // Catches anything React renders after mount — most importantly the plans
    // section re-rendering once live pricing arrives.
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [enabled]);
}
