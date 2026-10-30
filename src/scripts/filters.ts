import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { DUR, EASE, prefersReducedMotion } from './animations/anim.config';

gsap.registerPlugin(Flip);

interface ActiveTag {
  button: HTMLButtonElement;
  placeholder: HTMLElement;
  originalId: string;
  tag: string;
}

export function initTagFilter(): () => void {
  const root = document.querySelector<HTMLElement>('.post-index');
  if (!root) return () => {};
  const slot = root.querySelector<HTMLElement>('[data-active-filter]')!;
  const placeholderLabel = root.querySelector<HTMLElement>('[data-filter-placeholder]')!;
  const clearButton = root.querySelector<HTMLButtonElement>('[data-filter-clear]')!;
  const count = root.querySelector<HTMLElement>('[data-filter-count]')!;
  const emptyMessage = root.querySelector<HTMLElement>('[data-filter-empty-message]')!;
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-post-card]'));
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-filter-tag]'));
  const events = new AbortController();
  let active: ActiveTag | null = null;
  let version = 0;

  const tagId = (tag: string) => tag.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const updateCards = (tag: string | null, animate: boolean) => {
    const current = ++version;
    let visible = 0;
    cards.forEach((card) => {
      gsap.killTweensOf(card);
      const matches = !tag || (card.dataset.tags || '').split('|').includes(tag);
      if (matches) {
        visible += 1;
        card.hidden = false;
        if (animate && !prefersReducedMotion()) {
          gsap.fromTo(card, { opacity: 0.55, y: 4 }, { opacity: 1, y: 0, duration: DUR.micro, ease: EASE.out, overwrite: true });
        } else {
          gsap.set(card, { clearProps: 'opacity,transform,visibility' });
        }
      } else if (animate && !prefersReducedMotion()) {
        gsap.to(card, {
          opacity: 0,
          y: 4,
          duration: 0.12,
          ease: EASE.out,
          overwrite: true,
          onComplete: () => { if (current === version) card.hidden = true; }
        });
      } else {
        card.hidden = true;
      }
    });
    count.textContent = `${visible} results`;
    emptyMessage.hidden = visible !== 0;
  };

  const returnActive = (instant = false) => {
    if (!active) return;
    const current = active;
    active = null;
    Flip.killFlipsOf(current.button);
    const state = Flip.getState(current.button, { props: 'borderRadius,backgroundColor,borderColor' });
    current.placeholder.replaceWith(current.button);
    current.button.classList.remove('is-active');
    current.button.dataset.sharedId = current.originalId;
    placeholderLabel.hidden = false;
    clearButton.hidden = true;
    if (instant) gsap.set(current.button, { clearProps: 'transform,position,top,left,width,height,zIndex,opacity' });
    if (!instant && !prefersReducedMotion()) {
      Flip.from(state, { targets: current.button, duration: DUR.ui, ease: EASE.inOut, absolute: true, prune: true });
    }
  };

  const activate = (button: HTMLButtonElement, animate: boolean) => {
    if (active?.button === button) return;
    returnActive(true);
    const rect = button.getBoundingClientRect();
    const placeholder = document.createElement('span');
    placeholder.className = 'tag-placeholder';
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;
    button.parentElement?.insertBefore(placeholder, button);
    const originalId = button.dataset.sharedId || '';
    const tag = button.dataset.filterTag || '';
    const state = Flip.getState(button, { props: 'borderRadius,backgroundColor,borderColor' });
    slot.appendChild(button);
    button.classList.add('is-active');
    button.dataset.sharedId = `filter:tag:${tagId(tag)}`;
    placeholderLabel.hidden = true;
    clearButton.hidden = false;
    active = { button, placeholder, originalId, tag };
    if (animate && !prefersReducedMotion()) {
      Flip.from(state, { targets: button, duration: DUR.ui, ease: EASE.inOut, absolute: true, prune: true });
    }
    updateCards(tag, animate);
  };

  const setUrl = (tag: string | null, push: boolean) => {
    const url = new URL(location.href);
    if (tag) url.searchParams.set('tag', tag);
    else url.searchParams.delete('tag');
    if (push) history.pushState({ tag }, '', `${url.pathname}${url.search}`);
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const tag = button.dataset.filterTag || '';
      activate(button, true);
      setUrl(tag, true);
    }, { signal: events.signal });
  });

  clearButton.addEventListener('click', () => {
    returnActive();
    updateCards(null, true);
    setUrl(null, true);
  }, { signal: events.signal });

  const onPopState = () => {
    const tag = new URL(location.href).searchParams.get('tag');
    if (!tag) {
      returnActive();
      updateCards(null, true);
      return;
    }
    if (active?.tag === tag) return;
    const button = buttons.find((candidate) => candidate.parentElement && candidate.dataset.filterTag === tag);
    if (button) activate(button, true);
  };
  window.addEventListener('popstate', onPopState);

  const initialTag = new URL(location.href).searchParams.get('tag');
  if (initialTag) {
    const button = buttons.find((candidate) => candidate.dataset.filterTag === initialTag);
    if (button) activate(button, false);
  } else {
    updateCards(null, false);
  }

  return () => {
    events.abort();
    window.removeEventListener('popstate', onPopState);
    returnActive(true);
    gsap.killTweensOf(cards);
  };
}
