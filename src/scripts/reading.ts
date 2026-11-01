export function initReading(): () => void {
  const bar = document.querySelector<HTMLElement>('[data-scroll-bar]');
  const progress = document.querySelector<HTMLElement>('[data-scroll-progress]');
  const nib = document.querySelector<HTMLElement>('[data-scroll-nib]');
  const tocLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'));
  const sectionLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-section-link]'));
  const rail = document.querySelector<HTMLElement>('[data-section-rail]');

  const headings = tocLinks
    .map((link) => {
      const id = decodeURIComponent(link.hash.slice(1));
      const heading = document.getElementById(id);
      return heading ? { heading, link } : null;
    })
    .filter((entry): entry is { heading: HTMLElement; link: HTMLAnchorElement } => Boolean(entry));

  const sections = sectionLinks
    .map((link) => {
      const id = link.hash.slice(1);
      const section = document.getElementById(id);
      return section ? { section, link } : null;
    })
    .filter((entry): entry is { section: HTMLElement; link: HTMLAnchorElement } => Boolean(entry));

  let frame = 0;
  const update = () => {
    frame = 0;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    if (bar) bar.style.transform = `scaleX(${ratio})`;
    if (nib) nib.style.left = `${ratio * 100}%`;
    progress?.classList.toggle('is-visible', window.scrollY > 20);
    doc.style.setProperty('--grid-shift', `${(window.scrollY * 0.05).toFixed(1)}px`);

    if (headings.length) {
      let current = headings[0];
      headings.forEach((entry) => {
        if (entry.heading.getBoundingClientRect().top <= 140) current = entry;
      });
      headings.forEach((entry) => {
        const active = entry === current;
        entry.link.classList.toggle('is-active', active);
        if (active) entry.link.setAttribute('aria-current', 'location');
        else entry.link.removeAttribute('aria-current');
      });
    }

    if (sections.length) {
      let current = sections[0];
      sections.forEach((entry) => {
        const top = entry.section.getBoundingClientRect().top;
        if (top <= 180) current = entry;
      });
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) {
        current = sections[sections.length - 1];
      }
      sections.forEach((entry) => {
        const active = entry === current;
        entry.link.classList.toggle('is-active', active);
        if (active) entry.link.setAttribute('aria-current', 'location');
        else entry.link.removeAttribute('aria-current');
      });
      rail?.classList.toggle('is-on-cream', current.section.id === 'manifesto');
    }
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  update();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });

  return () => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
  };
}
