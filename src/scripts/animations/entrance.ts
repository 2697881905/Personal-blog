import { gsap } from 'gsap';
import { EASE, DUR } from './anim.config';

// Above-the-fold entrance: fade the loading veil, then stagger the hero bits.
// Elements are visible by default in CSS; we hide + reveal via GSAP so a JS
// failure never leaves content stuck invisible. The #page-entrance overlay
// (z-50) masks any first-frame flash until the reveal begins.
export function initEntrance(): void {
  const entrance = document.querySelector<HTMLElement>('#page-entrance');
  const bits = gsap.utils.toArray<HTMLElement>('[data-entrance]');

  const tl = gsap.timeline({
    defaults: { ease: EASE.out },
    onComplete: () => entrance?.classList.add('is-done'),
  });

  if (entrance) {
    tl.to(entrance, { autoAlpha: 0, duration: DUR.fast, ease: EASE.inOut, delay: 0.45 });
  }

  if (bits.length) {
    gsap.set(bits, { autoAlpha: 0, y: 18 });
    tl.to(bits, { autoAlpha: 1, y: 0, duration: DUR.slow, stagger: 0.12 }, entrance ? '-=0.2' : 0);
  }

  if (entrance) tl.set(entrance, { display: 'none' });
}
