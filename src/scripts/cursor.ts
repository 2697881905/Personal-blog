import { gsap } from 'gsap';
import { motionEnabled } from './motion-control';

/**
 * Pointer configuration:
 * - Native pointer is the default. No class, no follower, no lag.
 * - Opt in with <html data-cursor="technical"> for the arrow reticle.
 * - `followDuration: 0` means exact 1:1 tracking; increase only for a deliberate
 *   trailing effect.
 * - `data-cursor="read|open|…"` on an element supplies the contextual label.
 * - Visual tokens live in CSS variables: --cursor-fill, --cursor-outline,
 *   --cursor-accent and --cursor-label-gap.
 */
const CURSOR_OPTIONS = {
  enabled: true,
  followDuration: 0,
  hideNative: true
};

const ARROW_SVG = `
  <svg viewBox="0 0 22 26" width="22" height="26" aria-hidden="true">
    <path d="M1.7 1.6v19.6l5.1-4.8 3.7 7.5 4-1.9-3.6-7.2h7.2L1.7 1.6Z"
      fill="var(--cursor-fill, #fffce1)"
      stroke="var(--cursor-outline, #0e100f)"
      stroke-width="1.35"
      stroke-linejoin="round"/>
    <circle cx="3.1" cy="3.2" r="0.9" fill="var(--cursor-accent, #ff8709)"/>
  </svg>
`;

export function initCursor(): () => void {
  if (!CURSOR_OPTIONS.enabled || !motionEnabled()) return () => {};
  if (document.documentElement.dataset.cursor !== 'technical') return () => {};
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};

  const root = document.documentElement;
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = `<span class="cursor__arrow">${ARROW_SVG}</span><span class="cursor__label"></span>`;
  document.body.appendChild(cursor);
  if (CURSOR_OPTIONS.hideNative) root.classList.add('has-custom-cursor');

  const label = cursor.querySelector<HTMLElement>('.cursor__label')!;
  const arrow = cursor.querySelector<HTMLElement>('.cursor__arrow')!;
  const xTo = CURSOR_OPTIONS.followDuration > 0
    ? gsap.quickTo(cursor, 'x', { duration: CURSOR_OPTIONS.followDuration, ease: 'power3.out' })
    : null;
  const yTo = CURSOR_OPTIONS.followDuration > 0
    ? gsap.quickTo(cursor, 'y', { duration: CURSOR_OPTIONS.followDuration, ease: 'power3.out' })
    : null;
  const events = new AbortController();
  let visible = false;

  const onMove = (event: PointerEvent) => {
    if (!visible) {
      gsap.set(cursor, { x: event.clientX, y: event.clientY, autoAlpha: 1 });
      visible = true;
    } else if (xTo && yTo) {
      xTo(event.clientX);
      yTo(event.clientY);
    } else {
      gsap.set(cursor, { x: event.clientX, y: event.clientY });
    }
    const target = event.target instanceof Element ? event.target : null;
    cursor.classList.toggle('is-text', Boolean(target?.closest('input, textarea, select')));
  };

  const onOver = (event: PointerEvent) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLElement>('[data-cursor]');
    const text = target?.dataset.cursor || '';
    cursor.classList.toggle('is-active', Boolean(text));
    label.textContent = text;
  };

  const onLeave = () => {
    gsap.to(cursor, { autoAlpha: 0, duration: 0.1, overwrite: true });
    visible = false;
  };

  const onDown = () => gsap.to(arrow, { scale: 0.82, duration: 0.1, ease: 'power2.out' });
  const onUp = () => gsap.to(arrow, { scale: 1, duration: 0.16, ease: 'power2.out' });

  window.addEventListener('pointermove', onMove, { signal: events.signal, passive: true });
  window.addEventListener('pointerover', onOver, { signal: events.signal, passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave, { signal: events.signal });
  window.addEventListener('pointerdown', onDown, { signal: events.signal, passive: true });
  window.addEventListener('pointerup', onUp, { signal: events.signal, passive: true });

  return () => {
    events.abort();
    root.classList.remove('has-custom-cursor');
    cursor.remove();
    gsap.killTweensOf([cursor, arrow]);
  };
}
