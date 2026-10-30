export type MotionPreference = 'system' | 'full' | 'reduced';

const STORAGE_KEY = 'matcha:motion';
const ORDER: MotionPreference[] = ['system', 'full', 'reduced'];

export function getMotionPreference(): MotionPreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'full' || stored === 'reduced' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function motionEnabled(): boolean {
  const preference = getMotionPreference();
  if (preference === 'full') return true;
  if (preference === 'reduced') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function apply(preference: MotionPreference): void {
  const root = document.documentElement;
  if (preference === 'system') delete root.dataset.motion;
  else root.dataset.motion = preference;

  document.querySelectorAll<HTMLElement>('[data-motion-toggle]').forEach((button) => {
    const label = button.querySelector<HTMLElement>('[data-motion-state]');
    if (label) {
      const systemLow = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      label.textContent = preference === 'system'
        ? systemLow ? 'auto·low' : 'auto'
        : preference === 'full' ? 'full' : 'low';
    }
    button.dataset.motionPreference = preference;
    button.setAttribute(
      'aria-label',
      preference === 'system'
        ? '动效跟随系统，点击切换'
        : preference === 'full'
          ? '完整动效已开启，点击切换'
          : '低动效已开启，点击切换'
    );
    button.setAttribute('aria-pressed', String(preference === 'full'));
  });

  document.querySelectorAll<HTMLElement>('[data-motion-callout]').forEach((callout) => {
    callout.hidden = !(preference === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  });
}

export function initMotionControl(onChange: () => void): () => void {
  apply(getMotionPreference());
  const events = new AbortController();

  document.querySelectorAll<HTMLElement>('[data-motion-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const current = getMotionPreference();
      const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
      try {
        if (next === 'system') localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, next);
      } catch { /* Storage can be unavailable; the live preference still applies. */ }
      apply(next);
      onChange();
    }, { signal: events.signal });
  });

  return () => events.abort();
}
