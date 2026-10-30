import { gsap } from 'gsap';
import Lenis from 'lenis';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motionEnabled } from './motion-control';

const SMOOTH_SCROLL = {
  lerp: 0.1,
  wheelMultiplier: 1,
  anchorDuration: 0.9
};

export function initSmoothScroll(): () => void {
  if (!motionEnabled()) return () => {};

  const lenis = new Lenis({
    lerp: SMOOTH_SCROLL.lerp,
    smoothWheel: true,
    syncTouch: false,
    wheelMultiplier: SMOOTH_SCROLL.wheelMultiplier
  });

  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  const events = new AbortController();
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!anchor) return;
    const id = anchor.getAttribute('href')?.slice(1);
    const destination = id ? document.getElementById(id) : null;
    if (!destination) return;
    event.preventDefault();
    lenis.scrollTo(destination, { offset: -78, duration: SMOOTH_SCROLL.anchorDuration });
  }, { capture: true, signal: events.signal });

  requestAnimationFrame(() => ScrollTrigger.refresh());

  return () => {
    events.abort();
    gsap.ticker.remove(tick);
    lenis.off('scroll', ScrollTrigger.update);
    lenis.destroy();
  };
}
