import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EASE, DUR } from './anim.config';

// Floating navigation bar behavior:
//  - entrance: slide the bar down from the top on load
//  - scrolled state: strengthen the glass once the user leaves the very top
//  - active link: highlight the link whose section is in view
export function initNavbar(): void {
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  if (!nav) return;

  gsap.from(nav, {
    yPercent: -130,
    autoAlpha: 0,
    duration: DUR.slow,
    ease: EASE.out,
    delay: 0.15,
  });

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => nav.classList.toggle('is-scrolled', self.scroll() > 24),
  });

  nav.querySelectorAll<HTMLAnchorElement>('[data-nav-link]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const id = href.startsWith('#') ? href.slice(1) : '';
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: (self) => link.classList.toggle('is-active', self.isActive),
    });
  });
}
