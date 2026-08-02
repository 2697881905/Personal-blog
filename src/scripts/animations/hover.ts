import { gsap } from 'gsap';

// Hover interactions. Transform-based effects (magnetic, spotlight) are gated
// to devices with a real pointer by the orchestrator, so touch users are never
// surprised by movement they didn't cause. The nav underline also responds to
// keyboard focus.

// Magnetic buttons: the element eases toward the cursor while hovered, creating
// a tactile pull. Uses quickTo for allocation-free, 60fps updates.
export function initMagnetic(): void {
  const els = gsap.utils.toArray<HTMLElement>('[data-magnetic]');
  els.forEach((el) => {
    const strength = parseFloat(el.dataset.magnetic || '0.3');
    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const onEnter = () => gsap.to(el, { scale: 1.05, duration: 0.3, ease: 'power3.out' });
    const onLeave = () => {
      xTo(0);
      yTo(0);
      gsap.to(el, { scale: 1, duration: 0.45, ease: 'power3.out' });
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
  });
}

// GSAP-driven nav underline (scaleX). Triggered on both hover and focus.
export function initNavUnderline(): void {
  const links = gsap.utils.toArray<HTMLElement>('[data-nav-link]');
  links.forEach((link) => {
    const line = link.querySelector<HTMLElement>('.site-nav__underline');
    if (!line) return;
    const show = () => gsap.to(line, { scaleX: 1, duration: 0.35, ease: 'power3.out' });
    const hide = () => gsap.to(line, { scaleX: 0, duration: 0.3, ease: 'power3.in' });
    link.addEventListener('mouseenter', show);
    link.addEventListener('mouseleave', hide);
    link.addEventListener('focus', show);
    link.addEventListener('blur', hide);
  });
}

// Mouse-follow spotlight glow on cards. Writes CSS custom properties consumed by
// a ::after pseudo-element — the card itself is never repainted, and the effect
// is transform-free and pointer-events:none.
export function initSpotlight(): void {
  const els = gsap.utils.toArray<HTMLElement>('[data-spotlight]');
  els.forEach((el) => {
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    el.addEventListener('mousemove', onMove);
  });
}
