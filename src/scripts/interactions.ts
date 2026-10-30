import { gsap } from 'gsap';
import { FlipOverlay } from './transitions/flip';
import { prefersReducedMotion } from './animations/anim.config';

const ROUTE_PRELUDE_MS = 110;

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  // @ts-ignore -- deprecated API retained only as a legacy clipboard fallback.
  document.execCommand('copy');
  textarea.remove();
  return Promise.resolve();
}

export function initInteractions(): () => void {
  const overlay = new FlipOverlay();
  const events = new AbortController();
  const { signal } = events;
  const timers = new Set<number>();

  document.querySelectorAll<HTMLElement>('[data-project-card]').forEach((card) => {
    const openProject = () => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      overlay.open(card, {
        kind: 'project',
        title: card.dataset.projectTitle || '项目详情',
        expandClass: 'is-expanded'
      });
    };
    card.querySelector<HTMLElement>('[data-project-open]')?.addEventListener('click', openProject, { signal });
    card.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a, button')) return;
      openProject();
    }, { signal });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-qr]').forEach((button) => {
    button.addEventListener('click', () => {
      const icon = button.querySelector<HTMLElement>('[data-qr-icon]');
      const src = button.dataset.qr;
      if (!icon || !src) return;
      const label = button.dataset.label || '二维码';
      const content = document.createElement('div');
      const image = document.createElement('img');
      image.className = 'shared-overlay__qr';
      image.src = src;
      image.alt = `${label}二维码`;
      const text = document.createElement('p');
      text.className = 'shared-overlay__qr-label';
      text.textContent = `扫一扫 · ${label}`;
      content.append(image, text);
      overlay.open(icon, { kind: 'qr', title: label, content });
    }, { signal });
  });

  const article = document.querySelector<HTMLElement>('[data-article-body]');
  article?.querySelectorAll<HTMLImageElement>('img').forEach((image, index) => {
    image.dataset.sharedId = `media:${article.dataset.postSlug}:${index}`;
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `放大查看：${image.alt || '文章图片'}`);
    const open = () => overlay.open(image, {
      kind: 'lightbox',
      title: image.alt || '文章图片',
      expandClass: 'is-lightbox-media'
    });
    image.addEventListener('click', open, { signal });
    image.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    }, { signal });
  });

  article?.querySelectorAll<HTMLElement>('pre').forEach((pre, index) => {
    if (pre.parentElement?.classList.contains('code-block')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    wrapper.dataset.sharedId = `code:${article.dataset.postSlug}:${index}:surface`;
    pre.parentElement?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const header = document.createElement('div');
    header.className = 'code-block__header';
    const language = document.createElement('span');
    language.textContent = pre.dataset.language || 'code';
    const actions = document.createElement('div');
    actions.className = 'code-block__actions';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'code-block__button';
    copy.textContent = '复制';
    copy.setAttribute('aria-label', '复制代码');
    const expand = document.createElement('button');
    expand.type = 'button';
    expand.className = 'code-block__button';
    expand.textContent = '全屏';
    expand.setAttribute('aria-label', '全屏阅读代码');
    actions.append(copy, expand);
    header.append(language, actions);
    wrapper.prepend(header);

    copy.addEventListener('click', async () => {
      await copyText(pre.innerText);
      copy.textContent = '已复制 ✓';
      const timer = window.setTimeout(() => {
        copy.textContent = '复制';
        timers.delete(timer);
      }, 1600);
      timers.add(timer);
    }, { signal });
    expand.addEventListener('click', () => overlay.open(wrapper, {
      kind: 'code',
      title: '全屏阅读代码',
      expandClass: 'is-code-expanded'
    }), { signal });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-copy-link]').forEach((button) => {
    button.addEventListener('click', async () => {
      await copyText(location.href);
      button.textContent = 'copied ✓';
      const timer = window.setTimeout(() => {
        button.textContent = 'copy permalink';
        timers.delete(timer);
      }, 1600);
      timers.add(timer);
    }, { signal });
  });

  document.querySelectorAll<HTMLElement>('[data-route-card]').forEach((card) => {
    card.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('a, button')) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      card.querySelector<HTMLAnchorElement>('.post-row__title-link')?.click();
    }, { signal });
  });

  // A short, reversible departure phrase: the chosen log line remains crisp
  // while the rest of the index recedes, then the shared-element route takes over.
  document.querySelectorAll<HTMLAnchorElement>('[data-post-card] .post-row__cover-link, [data-post-card] .post-row__title-link')
    .forEach((link) => {
      let navigationArmed = false;
      link.addEventListener('click', (event) => {
        if (navigationArmed) {
          navigationArmed = false;
          return;
        }
        if (
          prefersReducedMotion() ||
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0 ||
          event.detail === 0
        ) return;

        const card = link.closest<HTMLElement>('[data-post-card]');
        if (!card) return;
        const siblings = Array.from(document.querySelectorAll<HTMLElement>('.post-row'))
          .filter((row) => row !== card);
        if (!siblings.length) return;

        event.preventDefault();
        navigationArmed = true;
        card.classList.add('is-departing');
        gsap.to(siblings, {
          autoAlpha: 0.1,
          y: 18,
          scale: 0.988,
          duration: 0.2,
          stagger: 0.01,
          ease: 'power2.out',
          overwrite: true
        });
        gsap.to(card, {
          backgroundColor: 'rgba(215,255,84,0.05)',
          scale: 1.008,
          duration: 0.2,
          ease: 'power2.out'
        });
        window.setTimeout(() => link.click(), ROUTE_PRELUDE_MS);
      }, { signal });
    });

  return () => {
    events.abort();
    timers.forEach((timer) => window.clearTimeout(timer));
    overlay.close(true);
  };
}
