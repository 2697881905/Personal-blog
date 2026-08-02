import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './anim.config';
import { initEntrance } from './entrance';
import { initScrollReveal } from './scrollReveal';
import { initParallax } from './parallax';
import { initNavbar } from './navbar';
import { initMagnetic, initNavUnderline, initSpotlight } from './hover';

let started = false;

export function initAnimations(): void {
  if (started) return;
  started = true;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // Reduced motion: ensure nothing is left hidden, then skip all animation.
  if (prefersReducedMotion()) {
    gsap.set('[data-reveal], [data-reveal-item], [data-entrance]', { autoAlpha: 1, y: 0 });
    return;
  }

  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // gsap.context scopes every animation created inside for clean HMR teardown.
  const ctx = gsap.context(() => {
    initEntrance();
    initScrollReveal();
    initParallax();
    initNavbar();
    initNavUnderline();
    if (isFinePointer) {
      initMagnetic();
      initSpotlight();
    }
  });

  // Recalculate trigger positions once async islands (React client:only) and
  // webfonts have settled — otherwise triggers can be mis-measured on first paint.
  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener('load', refresh);
  if (document.fonts?.ready) document.fonts.ready.then(refresh);
  window.setTimeout(refresh, 600);

  // Clean up on hot-module replacement to avoid duplicate triggers/buildup.
  const hot = (import.meta as { hot?: { dispose: (cb: () => void) => void } }).hot;
  if (hot) {
    hot.dispose(() => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    });
  }
}
