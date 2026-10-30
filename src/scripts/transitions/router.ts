import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { DUR, EASE, motionScale, prefersReducedMotion } from '../animations/anim.config';

gsap.registerPlugin(Flip);

const STORAGE_KEY = 'matcha:shared-route';

type StoredRect = { left: number; top: number; width: number; height: number };
type StoredRoute = { from: string; elements: Record<string, StoredRect> };

/** Capture real geometry for browsers without cross-document View Transitions. */
export function initRouteFallback(): () => void {
  const unsupported = !('startViewTransition' in document);

  const capture = () => {
    if (!unsupported) return;
    const elements: Record<string, StoredRect> = {};
    document.querySelectorAll<HTMLElement>('[data-shared-id^="post:"], [data-shared-id="site:brand"]').forEach((element) => {
      const id = element.dataset.sharedId;
      if (!id || element.closest('.shared-overlay')) return;
      const rect = element.getBoundingClientRect();
      if (rect.width && rect.height) {
        elements[id] = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      }
    });
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ from: location.pathname, elements } satisfies StoredRoute));
    } catch { /* Storage can be disabled; normal navigation still works. */ }
  };

  const restore = () => {
    if (!unsupported || prefersReducedMotion()) return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(STORAGE_KEY);
      const route = JSON.parse(raw) as StoredRoute;
      const targets: HTMLElement[] = [];
      Object.entries(route.elements).forEach(([id, rect]) => {
        const target = document.querySelector<HTMLElement>(`[data-shared-id="${CSS.escape(id)}"]`);
        if (!target) return;
        const next = target.getBoundingClientRect();
        gsap.set(target, {
          x: rect.left - next.left,
          y: rect.top - next.top,
          scaleX: rect.width / next.width,
          scaleY: rect.height / next.height,
          transformOrigin: 'top left'
        });
        targets.push(target);
      });
      if (!targets.length) return;
      const state = Flip.getState(targets, { props: 'borderRadius,backgroundColor,borderColor,letterSpacing' });
      gsap.set(targets, { clearProps: 'transform' });
      Flip.from(state, {
        targets,
        duration: DUR.route * motionScale(),
        ease: EASE.inOut,
        absolute: true,
        nested: true,
        prune: true
      });
    } catch { /* A malformed or unavailable cache must never block navigation. */ }
  };

  restore();
  window.addEventListener('pagehide', capture);
  return () => window.removeEventListener('pagehide', capture);
}
