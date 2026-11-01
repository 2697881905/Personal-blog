const TOUCH_TARGETS = [
  '.post-row',
  '.project-card',
  '.tag',
  '.text-button',
  '.site-nav__link',
  '.hero__links a',
  '.hero__links button',
  '.command-trigger',
  '.terminal-hints button',
  '.article-toc a',
  '.command-item',
  '.section-link',
  '.now-page__stack a',
  '.now-page__links a',
  '.verified-work__tags a',
  '.verified-work__repo',
  '.site-footer__links a',
  '.aside-stack a'
].join(',');

/**
 * Ember ripple at the touch point on coarse pointers. It lives outside the
 * target so scrolling containers and clipped cards cannot cut it off.
 */
export function initTouchFeedback(): () => void {
  if (!window.matchMedia('(hover: none), (pointer: coarse)').matches) return () => {};

  const controller = new AbortController();
  const ripples = new Set<HTMLElement>();
  const timers = new Set<number>();
  let lastTap = 0;

  const removeRipple = (ripple: HTMLElement) => {
    ripple.remove();
    ripples.delete(ripple);
  };

  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(TOUCH_TARGETS)) return;

    const now = performance.now();
    if (now - lastTap < 70) return;
    lastTap = now;

    const ripple = document.createElement('span');
    ripple.className = 'touch-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.left = `${event.clientX}px`;
    ripple.style.top = `${event.clientY}px`;
    ripples.add(ripple);
    document.body.appendChild(ripple);

    let timer = 0;
    const cleanup = () => {
      removeRipple(ripple);
      if (timer) {
        window.clearTimeout(timer);
        timers.delete(timer);
      }
    };
    ripple.addEventListener('animationend', cleanup, { once: true });
    timer = window.setTimeout(cleanup, 650);
    timers.add(timer);
  }, { passive: true, signal: controller.signal });

  return () => {
    controller.abort();
    timers.forEach((timer) => window.clearTimeout(timer));
    ripples.forEach((ripple) => ripple.remove());
    ripples.clear();
    timers.clear();
  };
}
