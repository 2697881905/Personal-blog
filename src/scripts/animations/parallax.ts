import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Lightweight parallax: translate elements a few percent as they pass through
// the viewport. Transform-only (compositor-friendly) and scrubbed, so it costs
// almost nothing on the main thread. Depth is configurable per element via
// the data-parallax attribute (percent of travel, default 8).
export function initParallax(): void {
  const items = gsap.utils.toArray<HTMLElement>('[data-parallax]');
  items.forEach((el) => {
    const depth = parseFloat(el.dataset.parallax || '8');
    gsap.fromTo(
      el,
      { yPercent: -depth / 2 },
      {
        yPercent: depth / 2,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
        },
      }
    );
  });
}
