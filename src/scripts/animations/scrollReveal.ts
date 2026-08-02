import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EASE, DUR } from './anim.config';

// Batched reveal: ONE ScrollTrigger watches many elements, which is far cheaper
// than a per-node trigger (fewer scroll listeners, less layout work). Plain
// sections fade-up; containers marked [data-reveal-stagger] animate their
// [data-reveal-item] children in sequence.
//
// Initial hidden state is applied via gsap.set at runtime (not CSS) so content
// stays visible if JavaScript fails to load.
export function initScrollReveal(): void {
  const items = gsap.utils.toArray<HTMLElement>('[data-reveal]');
  if (items.length) {
    gsap.set(items, { autoAlpha: 0, y: 28 });
    ScrollTrigger.batch(items, {
      start: 'top 88%',
      onEnter: (batch) =>
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          duration: DUR.base,
          ease: EASE.out,
          stagger: 0.08,
          overwrite: true,
        }),
    });
  }

  const parents = gsap.utils.toArray<HTMLElement>('[data-reveal-stagger]');
  parents.forEach((parent) => {
    const kids = gsap.utils.toArray<HTMLElement>('[data-reveal-item]', parent);
    if (!kids.length) return;
    gsap.set(kids, { autoAlpha: 0, y: 24 });
    ScrollTrigger.create({
      trigger: parent,
      start: 'top 85%',
      once: true,
      onEnter: () =>
        gsap.to(kids, {
          autoAlpha: 1,
          y: 0,
          duration: DUR.base,
          ease: EASE.out,
          stagger: 0.06,
          overwrite: true,
        }),
    });
  });
}
