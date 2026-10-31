import { motionEnabled } from './motion-control';

/**
 * The "distributed developer" layer: boot sequence, soft-bus topology,
 * IDE inspect tooltip, scramble decoding and the super-device mode.
 * Everything that moves is gated behind motionEnabled(); theme-only
 * features (super-device mode, scramble) stay available.
 */

const BOOT_KEY = 'matcha:booted';
const KONAMI_SEQUENCE = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
const SCRAMBLE_POOL = '!<>-_\\/[]{}=+*^?#01';
const SCRAMBLE_SELECTOR = '.site-nav__link, .site-footer__links a, .about-links a, [data-section-link], .aside-block > a';

const BOOT_LINES = [
  '[ 0.000000] matcha-os 3.1.0-gecko booting …',
  '[ 0.112441] cpu: 8 threads online · governor: caffeine-performance',
  '[ 0.301977] mount /dev/notes … 7 papers indexed',
  '[ 0.529310] mount /dev/projects … 3 builds verified',
  '[ 0.714655] insmod gsap.ko · scroll_driver=lenis · fps=120',
  '[ 0.802119] softbus: distributed pipeline ready · 5 peers online',
  '[ 0.912460] aa start: EntryAbility → onForeground',
  '[ 1.014770] phosphor warm · scanlines locked · grid stable',
  '[ 1.104882] auth guest@matcha — ACCESS GRANTED'
];

/* ── Scramble: hover text decodes through noise chars ─────── */
function initScramble(): () => void {
  const targets = Array.from(document.querySelectorAll<HTMLElement>(SCRAMBLE_SELECTOR))
    .filter((el) => (
      el.children.length === 0
      && !!el.textContent?.trim()
      && el.textContent.trim().length > 1
      && el.dataset.scrambleBound !== 'true'
    ));

  const timers = new Map<HTMLElement, number>();
  const events = new AbortController();

  const play = (el: HTMLElement) => {
    const original = el.dataset.orig ?? (el.dataset.orig = el.textContent || '');
    if (!original || timers.has(el)) return;
    let frame = 0;
    const total = Math.max(3, Math.min(6, Math.ceil(original.length / 2)));
    const id = window.setInterval(() => {
      frame += 1;
      if (frame >= total) {
        el.textContent = original;
        window.clearInterval(id);
        timers.delete(el);
        return;
      }
      const reveal = Math.floor((frame / total) * original.length);
      el.textContent = Array.from(original)
        .map((char, index) => {
          if (index < reveal || char === ' ' || char === '/') return char;
          return SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)];
        })
        .join('');
    }, 46);
    timers.set(el, id);
  };

  targets.forEach((el) => {
    el.dataset.scrambleBound = 'true';
    el.addEventListener('pointerenter', () => play(el), { signal: events.signal });
    el.addEventListener('focus', () => play(el), { signal: events.signal });
  });

  return () => {
    events.abort();
    timers.forEach((id) => window.clearInterval(id));
    targets.forEach((el) => { delete el.dataset.scrambleBound; });
  };
}

/* ── Boot sequence: fake kernel log, once per session ─────── */
function initBoot(): () => void {
  let seen = false;
  try {
    seen = sessionStorage.getItem(BOOT_KEY) === '1';
  } catch {}
  if (seen) return () => {};

  const screen = document.createElement('div');
  screen.className = 'boot-screen';
  screen.setAttribute('aria-hidden', 'true');
  screen.innerHTML = [
    '<div class="boot-screen__frame">',
    '  <div class="boot-screen__log"></div>',
    '  <div class="boot-screen__bar"><i></i></div>',
    '  <p class="boot-screen__skip">click / any key to skip</p>',
    '</div>'
  ].join('');
  document.body.appendChild(screen);

  const log = screen.querySelector<HTMLElement>('.boot-screen__log')!;
  const bar = screen.querySelector<HTMLElement>('.boot-screen__bar i')!;
  const events = new AbortController();
  const timers: number[] = [];
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    try {
      sessionStorage.setItem(BOOT_KEY, '1');
    } catch {}
    screen.classList.add('boot-screen--done');
    timers.push(window.setTimeout(() => screen.remove(), 640));
  };

  window.addEventListener('keydown', finish, { signal: events.signal });
  window.addEventListener('pointerdown', finish, { signal: events.signal });

  const tick = (line: number) => {
    if (done) return;
    if (line >= BOOT_LINES.length) {
      timers.push(window.setTimeout(finish, 260));
      return;
    }
    const row = document.createElement('p');
    row.textContent = BOOT_LINES[line];
    if (line === BOOT_LINES.length - 1) row.classList.add('boot-screen__ok');
    log.appendChild(row);
    while (log.children.length > 9) log.firstElementChild?.remove();
    bar.style.width = `${Math.round(((line + 1) / BOOT_LINES.length) * 100)}%`;
    timers.push(window.setTimeout(() => tick(line + 1), 92 + Math.random() * 88));
  };

  timers.push(window.setTimeout(() => tick(0), 140));

  return () => {
    events.abort();
    timers.forEach((id) => window.clearTimeout(id));
    screen.remove();
    try {
      sessionStorage.setItem(BOOT_KEY, '1');
    } catch {}
  };
}

/* ── Soft-bus topology over the hero ────────────────────────
   Five device peers drifting on the hero, wired by bezier links
   with data packets flowing along them — the "distributed soft
   bus" metaphor. Pointer near a peer lights it up and draws a
   discovery frame towards the pointer. `matcha:discover` makes
   every peer broadcast a pulse (fired by the `bus` command). */
interface Peer {
  label: string;
  bx: number;
  by: number;
  r: number;
  x: number;
  y: number;
  phase: number;
  amp: number;
  pulse: number;
}

interface Packet {
  from: number;
  to: number;
  edge: number;
  t: number;
  speed: number;
  color: string;
}

const PEER_DEFS: Array<{ label: string; bx: number; by: number; r: number }> = [
  { label: 'phone', bx: 0.615, by: 0.12, r: 7 },
  { label: 'pad', bx: 0.952, by: 0.3, r: 6 },
  { label: 'watch', bx: 0.968, by: 0.68, r: 5 },
  { label: 'audio', bx: 0.845, by: 0.94, r: 4.5 },
  { label: 'iot', bx: 0.475, by: 0.96, r: 4 }
];

const EDGES: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2]];
const PACKET_COLORS = ['255,135,9', '157,149,255', '0,186,226'];

function initSoftBus(): () => void {
  const hero = document.querySelector<HTMLElement>('.hero');
  if (!hero || hero.querySelector('.softbus-canvas')) return () => {};

  const canvas = document.createElement('canvas');
  canvas.className = 'softbus-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const orb = hero.querySelector('[data-hero-orb]');
  if (orb?.nextSibling) hero.insertBefore(canvas, orb.nextSibling);
  else hero.prepend(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return () => {};
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let raf = 0;
  let last = 0;
  let running = true;
  let inView = true;
  let pointerX = -1;
  let pointerY = -1;
  let boost = 1;
  let broadcastAt = 2;

  const peers: Peer[] = PEER_DEFS.map((def, index) => ({
    ...def,
    x: 0,
    y: 0,
    phase: index * 1.7,
    amp: 9 + Math.random() * 10,
    pulse: -1
  }));

  const packets: Packet[] = EDGES.flatMap(([from, to], edge) => [0, 1].map((slot) => ({
    from,
    to,
    edge,
    t: (slot + edge * 0.31) % 1,
    speed: 0.1 + Math.random() * 0.07,
    color: PACKET_COLORS[(edge + slot) % PACKET_COLORS.length]
  })));

  const bend = (peerA: Peer, peerB: Peer, edge: number) => {
    const mx = (peerA.x + peerB.x) / 2;
    const my = (peerA.y + peerB.y) / 2;
    const dx = peerB.x - peerA.x;
    const dy = peerB.y - peerA.y;
    const len = Math.hypot(dx, dy) || 1;
    const dir = edge % 2 ? -1 : 1;
    return { cx: mx + (-dy / len) * len * 0.16 * dir, cy: my + (dx / len) * len * 0.16 * dir };
  };

  const qPoint = (ax: number, ay: number, cx: number, cy: number, bx: number, by: number, t: number) => {
    const k = 1 - t;
    return {
      x: k * k * ax + 2 * k * t * cx + t * t * bx,
      y: k * k * ay + 2 * k * t * cy + t * t * by
    };
  };

  const resize = () => {
    const rect = hero.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
  };
  resize();

  const draw = (time: number) => {
    raf = requestAnimationFrame(draw);
    if (!running || !inView) return;
    if (time - last < 33) return;
    const dt = Math.min(0.05, (time - last) / 1000 || 0.033);
    last = time;
    if (boost > 1) boost = Math.max(1, boost - dt * 0.9);

    const hack = document.documentElement.dataset.hack === 'on';
    const t = time / 1000;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    ctx.font = '9px "Geist Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';

    peers.forEach((peer) => {
      peer.x = peer.bx * width + Math.sin(t * 0.28 + peer.phase) * peer.amp;
      peer.y = peer.by * height + Math.cos(t * 0.22 + peer.phase * 1.3) * peer.amp;
    });

    const lineColor = hack ? 'rgba(0,255,156,0.18)' : 'rgba(255,252,225,0.11)';
    EDGES.forEach(([from, to], edge) => {
      const { cx, cy } = bend(peers[from], peers[to], edge);
      ctx.strokeStyle = lineColor;
      ctx.beginPath();
      ctx.moveTo(peers[from].x, peers[from].y);
      ctx.quadraticCurveTo(cx, cy, peers[to].x, peers[to].y);
      ctx.stroke();
    });

    packets.forEach((packet) => {
      packet.t += packet.speed * boost * dt * 3.4;
      if (packet.t > 1) packet.t -= 1;
      const peerA = peers[packet.from];
      const peerB = peers[packet.to];
      const { cx, cy } = bend(peerA, peerB, packet.edge);
      const head = qPoint(peerA.x, peerA.y, cx, cy, peerB.x, peerB.y, packet.t);
      const tail = qPoint(peerA.x, peerA.y, cx, cy, peerB.x, peerB.y, Math.max(0, packet.t - 0.07));
      ctx.fillStyle = `rgba(${packet.color},0.32)`;
      ctx.beginPath();
      ctx.arc(tail.x, tail.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${packet.color},0.92)`;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    let nearIndex = -1;
    let nearDist = 72;
    peers.forEach((peer, index) => {
      const distance = Math.hypot(peer.x - pointerX, peer.y - pointerY);
      if (distance < nearDist) {
        nearDist = distance;
        nearIndex = index;
      }
    });

    if (t > broadcastAt) {
      peers[(Math.random() * peers.length) | 0].pulse = t;
      broadcastAt = t + 4 + Math.random() * 4;
    }

    peers.forEach((peer, index) => {
      const near = index === nearIndex;
      const tone = near ? '255,135,9' : hack ? '0,255,156' : '255,252,225';
      const labelTone = near ? '255,135,9' : hack ? '0,255,156' : '185,183,166';

      ctx.strokeStyle = `rgba(${tone},0.55)`;
      ctx.beginPath();
      ctx.arc(peer.x, peer.y, peer.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(${tone},0.9)`;
      ctx.beginPath();
      ctx.arc(peer.x, peer.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${labelTone},0.78)`;
      ctx.fillText(peer.label, peer.x, peer.y + peer.r + 13);

      if (near) {
        ctx.strokeStyle = 'rgba(255,135,9,0.22)';
        ctx.beginPath();
        ctx.arc(peer.x, peer.y, peer.r + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = 'rgba(255,135,9,0.6)';
        ctx.beginPath();
        ctx.moveTo(peer.x, peer.y);
        ctx.lineTo(pointerX, pointerY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (peer.pulse > 0) {
        const age = t - peer.pulse;
        if (age < 1.4) {
          const k = age / 1.4;
          ctx.strokeStyle = `rgba(${hack ? '0,255,156' : '255,135,9'},${(1 - k) * 0.55})`;
          ctx.beginPath();
          ctx.arc(peer.x, peer.y, peer.r + 4 + k * 30, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          peer.pulse = -1;
        }
      }
    });
  };
  raf = requestAnimationFrame(draw);

  const ro = new ResizeObserver(resize);
  ro.observe(hero);

  const io = new IntersectionObserver((entries) => {
    inView = entries.some((entry) => entry.isIntersecting);
  });
  io.observe(hero);

  const onDiscover = () => {
    const now = performance.now() / 1000;
    peers.forEach((peer) => { peer.pulse = now; });
    boost = 2.6;
  };
  const onVisibility = () => { running = document.visibilityState !== 'hidden'; };
  const onMove = (event: PointerEvent) => {
    const rect = hero.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
  };
  const onLeave = () => {
    pointerX = -1;
    pointerY = -1;
  };

  window.addEventListener('matcha:discover', onDiscover);
  document.addEventListener('visibilitychange', onVisibility);
  hero.addEventListener('pointermove', onMove, { passive: true });
  hero.addEventListener('pointerleave', onLeave, { passive: true });

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener('matcha:discover', onDiscover);
    document.removeEventListener('visibilitychange', onVisibility);
    hero.removeEventListener('pointermove', onMove);
    hero.removeEventListener('pointerleave', onLeave);
    canvas.remove();
  };
}

/* ── IDE inspect tooltip on the hero title ──────────────────
   Hovering the name opens a DevEco-style ArkTS inspector with
   line numbers and syntax highlight, rows unfolding in order. */
const TIP_ROWS: string[] = [
  '<i class="ln">1</i><span class="c-cm">// entry ability · ArkTS</span>',
  '<i class="ln">2</i><span class="c-de">@Entry</span>',
  '<i class="ln">3</i><span class="c-de">@Component</span>',
  '<i class="ln">4</i><span class="c-kw">struct</span> <span class="c-ty">MatchaProfile</span> {',
  '<i class="ln">5</i>  <span class="c-de">@State</span> mood: <span class="c-ty">string</span> = <span class="c-str">\'caffeine 87%\'</span>',
  '<i class="ln">6</i>  <span class="c-kw">build</span>() {',
  '<i class="ln">7</i>    <span class="c-fn">Column</span>() {',
  '<i class="ln">8</i>      <span class="c-fn">Text</span>(<span class="c-str">\'抹茶味的琴\'</span>).<span class="c-fn">fontSize</span>(<span class="c-num">48</span>)',
  '<i class="ln">9</i>    }',
  '<i class="ln">10</i>  }',
  '<i class="ln">11</i>}'
];

function initInspect(): () => void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  const hero = document.querySelector<HTMLElement>('.hero');
  const title = document.querySelector<HTMLElement>('.hero__title');
  if (!hero || !title || title.dataset.inspectBound === 'true') return () => {};
  title.dataset.inspectBound = 'true';

  const tip = document.createElement('div');
  tip.className = 'ide-tip';
  tip.setAttribute('aria-hidden', 'true');
  tip.innerHTML = TIP_ROWS
    .map((row, index) => `<div class="ide-tip__row" style="--i:${index}">${row}</div>`)
    .join('');
  hero.appendChild(tip);

  const events = new AbortController();
  const show = () => {
    const heroRect = hero.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    tip.style.left = `${Math.max(12, Math.round(titleRect.left - heroRect.left + 12))}px`;
    tip.style.top = `${Math.round(titleRect.bottom - heroRect.top + 20)}px`;
    tip.classList.add('is-visible');
  };
  const hide = () => tip.classList.remove('is-visible');

  title.addEventListener('pointerenter', show, { signal: events.signal });
  title.addEventListener('pointerleave', hide, { signal: events.signal });

  return () => {
    events.abort();
    tip.remove();
    delete title.dataset.inspectBound;
  };
}

/* ── Super-device mode (Konami), toast + shake events ─────── */
let toastTimer = 0;

function toast(message: string, state: 'on' | 'off'): void {
  let el = document.querySelector<HTMLElement>('.hack-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'hack-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.dataset.state = state;
  el.textContent = message;
  el.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el?.classList.remove('is-visible'), 2600);
}

function toggleSuperDeviceMode(): void {
  const root = document.documentElement;
  const on = root.dataset.hack === 'on';
  if (on) delete root.dataset.hack;
  else root.dataset.hack = 'on';
  toast(on ? 'super device unlinked' : 'super device linked · distributed mode', on ? 'off' : 'on');
}

function initKonami(): () => void {
  let progress = 0;
  const onKey = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (key === KONAMI_SEQUENCE[progress]) {
      progress += 1;
      if (progress === KONAMI_SEQUENCE.length) {
        progress = 0;
        toggleSuperDeviceMode();
      }
    } else {
      progress = key === KONAMI_SEQUENCE[0] ? 1 : 0;
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

function initTerminalEvents(): () => void {
  const onShake = () => {
    const card = document.querySelector<HTMLElement>('[data-terminal]');
    if (!card) return;
    card.classList.remove('shake-hard');
    void card.offsetWidth;
    card.classList.add('shake-hard');
    window.setTimeout(() => card.classList.remove('shake-hard'), 560);
  };
  window.addEventListener('matcha:shake', onShake);
  return () => window.removeEventListener('matcha:shake', onShake);
}

/* ── Entry point, wired into the motion stack in site.ts ──── */
export function initHackerExperience(): () => void {
  const cleanups: Array<() => void> = [
    initScramble(),
    initKonami(),
    initTerminalEvents()
  ];
  if (motionEnabled() && document.querySelector('.hero__title')) {
    cleanups.push(initBoot(), initSoftBus(), initInspect());
  }
  return () => cleanups.forEach((cleanup) => cleanup());
}
