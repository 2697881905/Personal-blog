const THEME_KEY = 'matcha:theme';
const LIGHT_THEME_COLOR = '#f2f5fa';
const DARK_THEME_COLOR = '#06080d';

export type Theme = 'light' | 'dark';

interface ThemeViewTransition {
  ready: Promise<void>;
  finished: Promise<void>;
}

type ThemeTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => ThemeViewTransition;
};

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function syncToggle(theme: Theme): void {
  document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((button) => {
    const light = theme === 'light';
    button.setAttribute('aria-pressed', String(light));
    button.setAttribute('aria-label', light ? '切换到深色显示' : '切换到浅色显示');
  });
}

function pulseFrom(button: HTMLElement): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const reach = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );
  const ripple = document.createElement('span');
  ripple.className = 'theme-ripple';
  ripple.setAttribute('aria-hidden', 'true');
  ripple.style.setProperty('--ripple-x', `${x}px`);
  ripple.style.setProperty('--ripple-y', `${y}px`);
  ripple.style.setProperty('--ripple-size', `${Math.min(4000, Math.ceil(reach * 2))}px`);
  document.body.appendChild(ripple);
  window.setTimeout(() => ripple.remove(), 720);
}

function applyTheme(theme: Theme, persist: boolean): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // 退出 phosphor 彩蛋，保证切换按钮行为可预期。
  if (persist && root.dataset.hack === 'on') delete root.dataset.hack;
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? LIGHT_THEME_COLOR : DARK_THEME_COLOR;
  syncToggle(theme);
}

export function initThemeToggle(): () => void {
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('[data-theme-toggle]'));
  const root = document.documentElement;
  const hasTheme = root.dataset.theme === 'light' || root.dataset.theme === 'dark';
  const theme = storedTheme() ?? (hasTheme ? currentTheme() : systemTheme());
  // 每次路由切换后重新应用已保存偏好，避免旧属性覆盖用户选择。
  applyTheme(theme, false);

  let transitioning = false;
  const onClick = (event: Event) => {
    if (transitioning) return;
    const button = event.currentTarget as HTMLElement;
    const next: Theme = currentTheme() === 'light' ? 'dark' : 'light';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const doc = document as ThemeTransitionDocument;

    if (!doc.startViewTransition || reduce) {
      if (!reduce) pulseFrom(button);
      applyTheme(next, true);
      return;
    }

    transitioning = true;
    root.classList.add('theme-transition');
    try {
      const transition = doc.startViewTransition(() => applyTheme(next, true));
      transition.ready.then(() => pulseFrom(button)).catch(() => {});
      transition.finished.finally(() => {
        transitioning = false;
        root.classList.remove('theme-transition');
      }).catch(() => {});
    } catch {
      transitioning = false;
      root.classList.remove('theme-transition');
      pulseFrom(button);
      applyTheme(next, true);
    }
  };

  buttons.forEach((button) => button.addEventListener('click', onClick));
  return () => {
    buttons.forEach((button) => button.removeEventListener('click', onClick));
  };
}
