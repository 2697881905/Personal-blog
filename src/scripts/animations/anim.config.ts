import { gsap } from 'gsap';

// Single source of truth for the site's motion language.
// Keep in sync with the CSS custom properties in global.css (--ease-apple, --dur-*).
export const EASE = {
  out: 'power3.out',
  inOut: 'power2.inOut',
  back: 'back.out(1.7)',
  expo: 'expo.out',
  soft: 'power1.out',
} as const;

export const DUR = {
  micro: 0.2,
  fast: 0.35,
  base: 0.6,
  slow: 1.0,
} as const;

// Tailwind breakpoints, mirrored here for JS-side media matching.
export const BP = {
  sm: 640,
  md: 768,
  lg: 1024,
} as const;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
