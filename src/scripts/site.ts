import { initInteractions } from './interactions';
import { initTagFilter } from './filters';
import { initRouteFallback } from './transitions/router';
import { initTerminal } from './terminal';
import { initCommandPalette } from './palette';
import { initReading } from './reading';
import { initMotionScenes } from './motion';
import { motionEnabled } from './motion-control';
import { initSmoothScroll } from './smooth';
import { initTrace } from './trace';
import { initHackerExperience } from './hacker';
import { initTouchFeedback } from './touch';
import { initThemeToggle } from './theme';

let cleanups: Array<() => void> = [];
let motionCleanups: Array<() => void> = [];

function destroyMotionExperience(): void {
  motionCleanups.forEach((cleanup) => cleanup());
  motionCleanups = [];
}

function refreshMotionExperience(): void {
  destroyMotionExperience();
  if (!motionEnabled()) return;
  motionCleanups = [
    initMotionScenes(),
    initTrace(),
    initSmoothScroll(),
    initHackerExperience()
  ];
}

function initClocks(): () => void {
  const short = document.querySelectorAll<HTMLTimeElement>('[data-local-time]');
  const full = document.querySelectorAll<HTMLElement>('[data-local-clock]');
  if (!short.length && !full.length) return () => {};

  const shortFormat = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const fullFormat = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const tick = () => {
    const now = new Date();
    short.forEach((element) => { element.textContent = shortFormat.format(now); });
    full.forEach((element) => { element.textContent = fullFormat.format(now); });
    short.forEach((element) => { element.dateTime = now.toISOString(); });
  };

  tick();
  const timer = window.setInterval(tick, 1000);
  return () => window.clearInterval(timer);
}

export function initSite(): void {
  destroySite();
  cleanups = [
    initInteractions(),
    initTagFilter(),
    initRouteFallback(),
    initTerminal(),
    initCommandPalette(),
    initReading(),
    initClocks(),
    initTouchFeedback(),
    initThemeToggle(),
    destroyMotionExperience
  ];
  refreshMotionExperience();
}

export function destroySite(): void {
  destroyMotionExperience();
  cleanups.forEach((cleanup) => cleanup());
  cleanups = [];
}
