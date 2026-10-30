interface CommandItem {
  title: string;
  description: string;
  href: string;
  kind: string;
  meta: string;
  search: string;
}

export function initCommandPalette(): () => void {
  const root = document.querySelector<HTMLElement>('[data-command-layer]');
  const input = document.querySelector<HTMLInputElement>('[data-command-input]');
  const results = document.querySelector<HTMLElement>('[data-command-results]');
  if (!root || !input || !results) return () => {};

  const events = new AbortController();
  const { signal } = events;
  let items: CommandItem[] | null = null;
  let visible: CommandItem[] = [];
  let activeIndex = 0;
  let previousFocus: HTMLElement | null = null;
  let previousOverflow = '';
  let inertElements: HTMLElement[] = [];
  let closeTimer = 0;

  const load = async () => {
    if (items) return items;
    try {
      const response = await fetch('/search.json');
      items = response.ok ? await response.json() as CommandItem[] : [];
    } catch {
      items = [];
    }
    return items;
  };

  const select = (index: number) => {
    activeIndex = Math.max(0, Math.min(visible.length - 1, index));
    results.querySelectorAll<HTMLElement>('[data-command-item]').forEach((item, itemIndex) => {
      const active = itemIndex === activeIndex;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
      if (active) item.scrollIntoView({ block: 'nearest' });
    });
  };

  const navigateTo = (href: string) => {
    close();
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const render = () => {
    const query = input.value.trim().toLowerCase();
    visible = (items || []).filter((item) => !query || item.search.toLowerCase().includes(query)).slice(0, 9);
    activeIndex = 0;
    results.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'command-empty';
      empty.textContent = 'no matching entries.';
      results.appendChild(empty);
      input.setAttribute('aria-expanded', 'false');
      return;
    }
    input.setAttribute('aria-expanded', 'true');
    visible.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'command-item';
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === 0));
      button.dataset.commandItem = '';
      const kind = document.createElement('span');
      kind.className = 'command-item__kind';
      kind.textContent = item.kind;
      const copy = document.createElement('span');
      copy.className = 'command-item__copy';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const description = document.createElement('small');
      description.textContent = item.description;
      copy.append(title, description);
      const meta = document.createElement('span');
      meta.className = 'command-item__meta';
      meta.textContent = item.meta;
      button.append(kind, copy, meta);
      button.addEventListener('click', () => navigateTo(item.href), { signal });
      results.appendChild(button);
    });
    select(0);
  };

  const open = async () => {
    if (document.querySelector('.shared-overlay')) return;
    window.clearTimeout(closeTimer);
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousOverflow = document.body.style.overflow;
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    inertElements = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        element !== root &&
        !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName)
    );
    inertElements.forEach((element) => { element.inert = true; });
    requestAnimationFrame(() => root.classList.add('is-open'));
    input.value = '';
    await load();
    render();
    input.focus({ preventScroll: true });
  };

  const close = () => {
    if (root.hidden) return;
    root.classList.remove('is-open');
    document.body.style.overflow = previousOverflow;
    inertElements.forEach((element) => { element.inert = false; });
    previousFocus?.focus({ preventScroll: true });
    closeTimer = window.setTimeout(() => { root.hidden = true; }, 140);
  };

  document.querySelectorAll<HTMLElement>('[data-command-open]').forEach((button) => {
    button.addEventListener('click', () => { void open(); }, { signal });
  });
  document.querySelectorAll<HTMLElement>('[data-command-close]').forEach((button) => {
    button.addEventListener('click', close, { signal });
  });

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (root.hidden) void open();
      else close();
      return;
    }
    if (event.key === 'Escape' && !root.hidden) {
      event.preventDefault();
      close();
    }
  }, { signal });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(root.querySelectorAll<HTMLElement>('button, input'))
      .filter((element) => !element.hasAttribute('disabled'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, { signal });

  input.addEventListener('input', render, { signal });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      select(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      select(activeIndex - 1);
    } else if (event.key === 'Enter' && visible[activeIndex]) {
      event.preventDefault();
      navigateTo(visible[activeIndex].href);
    }
  }, { signal });

  return () => {
    events.abort();
    window.clearTimeout(closeTimer);
    inertElements.forEach((element) => { element.inert = false; });
    root.hidden = true;
    document.body.style.overflow = previousOverflow;
  };
}
