export const EASE = {
  out: 'power3.out',
  inOut: 'power3.inOut',
  expo: 'expo.out'
} as const;

export const DUR = {
  press: 0.14,
  micro: 0.16,
  ui: 0.22,
  overlay: 0.28,
  route: 0.42
} as const;

export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  const preference = document.documentElement.dataset.motion;
  if (preference === 'full') return false;
  if (preference === 'reduced') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const motionScale = (): number =>
  window.matchMedia('(max-width: 700px)').matches ? 0.8 : 1;
