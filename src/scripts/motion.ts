import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motionEnabled } from './motion-control';

gsap.registerPlugin(ScrollTrigger);

function splitElement(element: HTMLElement): HTMLElement[] {
  if (element.dataset.splitReady === 'true') {
    return Array.from(element.querySelectorAll<HTMLElement>('.char'));
  }

  const accessibleLabel = (element.textContent || '').replace(/\s+/g, ' ').trim();
  element.setAttribute('aria-label', accessibleLabel);

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
  textNodes.forEach((node) => {
    const text = node.nodeValue || '';
    if (!text.trim()) return;
    const fragment = document.createDocumentFragment();
    for (const part of segmenter.segment(text)) {
      if (!part.segment.trim()) {
        fragment.appendChild(document.createTextNode(' '));
        continue;
      }
      const word = document.createElement('span');
      word.className = 'split-word';
      word.setAttribute('aria-hidden', 'true');
      Array.from(part.segment).forEach((character) => {
        const mask = document.createElement('span');
        mask.className = 'char-mask';
        const char = document.createElement('span');
        char.className = 'char';
        char.textContent = character;
        mask.appendChild(char);
        word.appendChild(mask);
      });
      fragment.appendChild(word);
    }
    node.replaceWith(fragment);
  });

  element.dataset.splitReady = 'true';
  if (element.classList.contains('hero__title')) {
    const words = element.querySelectorAll<HTMLElement>('.split-word');
    const lastWord = words[words.length - 1];
    lastWord?.querySelector<HTMLElement>('.char:last-child')?.classList.add('accent-character');
  }
  return Array.from(element.querySelectorAll<HTMLElement>('.char'));
}

/** Split a manifesto line into word spans without destroying inline <em>. */
function splitWords(element: HTMLElement): HTMLElement[] {
  if (element.dataset.wordsReady === 'true') {
    return Array.from(element.querySelectorAll<HTMLElement>('.mword'));
  }

  const accessibleLabel = (element.textContent || '').replace(/\s+/g, ' ').trim();
  element.setAttribute('aria-label', accessibleLabel);

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
  textNodes.forEach((node) => {
    const text = node.nodeValue || '';
    if (!text.trim()) return;
    const fragment = document.createDocumentFragment();
    for (const part of segmenter.segment(text)) {
      if (!part.segment.trim()) {
        fragment.appendChild(document.createTextNode(' '));
        continue;
      }
      const word = document.createElement('span');
      word.className = 'mword';
      word.setAttribute('aria-hidden', 'true');
      word.textContent = part.segment;
      fragment.appendChild(word);
    }
    node.replaceWith(fragment);
  });

  element.dataset.wordsReady = 'true';
  return Array.from(element.querySelectorAll<HTMLElement>('.mword'));
}

export function initMotionScenes(): () => void {
  if (!motionEnabled()) return () => {};

  const splitElements = Array.from(document.querySelectorAll<HTMLElement>('[data-split]'));
  splitElements.forEach(splitElement);
  const events = new AbortController();

  const context = gsap.context(() => {
    ScrollTrigger.config({ ignoreMobileResize: true });

    // Endless type ribbons: one slow clock, accelerated by scroll velocity.
    const marqueeLoops: ReturnType<typeof gsap.to>[] = [];
    document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((marquee) => {
      const track = marquee.querySelector<HTMLElement>('[data-marquee-track]');
      if (!track) return;
      marqueeLoops.push(gsap.to(track, {
        xPercent: -50,
        duration: Number(marquee.dataset.duration) || 30,
        ease: 'none',
        repeat: -1
      }));
    });

    const skewSetters = Array.from(document.querySelectorAll<HTMLElement>('.post-list, .project-list'))
      .map((list) => gsap.quickTo(list, 'skewY', { duration: 0.5, ease: 'power3.out' }));

    ScrollTrigger.create({
      trigger: document.body,
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const velocity = self.getVelocity();
        const skew = gsap.utils.clamp(-2.2, 2.2, velocity / 850);
        const resting = Math.abs(velocity) < 40;
        skewSetters.forEach((set) => set(resting ? 0 : skew));
        const speed = 1 + Math.min(Math.abs(velocity) / 2400, 2.4);
        marqueeLoops.forEach((loop) => loop.timeScale(speed));
      }
    });

    const hero = document.querySelector<HTMLElement>('.hero');
    const heroTitle = hero?.querySelector<HTMLElement>('.hero__title');
    const heroChars = heroTitle ? Array.from(heroTitle.querySelectorAll<HTMLElement>('.char')) : [];

    if (hero && heroTitle && heroChars.length) {
      const orb = hero.querySelector<HTMLElement>('[data-hero-orb]');
      gsap.set(heroTitle, { transformPerspective: 900 });
      gsap.set(heroChars, {
        yPercent: 92,
        rotationX: -82,
        opacity: 0,
        transformOrigin: '50% 100%'
      });

      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
      intro
        .from(hero.querySelector('.path-label'), { y: 14, autoAlpha: 0, duration: 0.5 }, 0)
        .to(heroChars, {
          yPercent: 0,
          rotationX: 0,
          opacity: 1,
          duration: 1.05,
          stagger: 0.045,
          ease: 'expo.out'
        }, 0.06)
        .from(
          hero.querySelectorAll('.hero__role, .hero__bio, .hero__meta, .hero__links'),
          { y: 18, autoAlpha: 0, duration: 0.62, stagger: 0.06 },
          0.26
        )
        .from('.terminal-card', {
          xPercent: 6,
          y: 34,
          autoAlpha: 0,
          clipPath: 'inset(0 0 0 100%)',
          duration: 1.1,
          ease: 'expo.out'
        }, 0.16)
        .from('.terminal-line', { autoAlpha: 0, y: 6, duration: 0.26, stagger: 0.05 }, 0.5)
        .from('.hero__caret', { autoAlpha: 0, duration: 0.22 }, 0.8);

      if (orb) {
        gsap.from(orb, { autoAlpha: 0, scale: 1.06, duration: 1.8, ease: 'power2.out' });
        gsap.to(orb, {
          yPercent: 5,
          scale: 1.04,
          duration: 9,
          delay: 1.1,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut'
        });

        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
          const orbX = gsap.quickTo(orb, 'x', { duration: 0.9, ease: 'power3.out' });
          const orbY = gsap.quickTo(orb, 'y', { duration: 0.9, ease: 'power3.out' });
          hero.addEventListener('pointermove', (event: PointerEvent) => {
            const bounds = hero.getBoundingClientRect();
            orbX(((event.clientX - bounds.left) / bounds.width - 0.5) * 34);
            orbY(((event.clientY - bounds.top) / bounds.height - 0.5) * 22);
          }, { signal: events.signal, passive: true });
          hero.addEventListener('pointerleave', () => {
            orbX(0);
            orbY(0);
          }, { signal: events.signal, passive: true });
        }
      }
    }

    const manifesto = document.querySelector<HTMLElement>('[data-manifesto]');
    if (manifesto) {
      const lines = Array.from(manifesto.querySelectorAll<HTMLElement>('[data-manifesto-line]'));
      const words = lines.flatMap((line) => splitWords(line));
      const fill = manifesto.querySelector<HTMLElement>('[data-manifesto-fill]');
      const ghost = manifesto.querySelector<HTMLElement>('[data-manifesto-ghost]');
      const count = manifesto.querySelector<HTMLElement>('[data-manifesto-count]');
      const glow = manifesto.querySelector<HTMLElement>('[data-manifesto-glow]');

      const revealUnit = 0.14;
      const revealDuration = 0.9;
      const revealTotal = revealDuration + Math.max(0, words.length - 1) * revealUnit;

      gsap.set(words, { opacity: 0.18, yPercent: 22 });
      const manifestoLine = gsap.timeline({
        scrollTrigger: {
          trigger: manifesto,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.55,
          onUpdate: (self) => {
            const index = Math.min(2, Math.floor(self.progress * 3));
            const label = String(index + 1).padStart(2, '0');
            if (count) count.textContent = label;
            if (ghost) ghost.textContent = label;
          }
        }
      });

      manifestoLine
        .to(words, {
          opacity: 1,
          yPercent: 0,
          duration: revealDuration,
          stagger: revealUnit,
          ease: 'power2.out'
        }, 0)
        .to(fill, { scaleX: 1, duration: revealTotal, ease: 'none' }, 0)
        .to(glow, { xPercent: -26, yPercent: 16, scale: 1.18, duration: revealTotal, ease: 'none' }, 0)
        .to(ghost, { yPercent: -10, rotate: -5, duration: revealTotal, ease: 'none' }, 0);
    }

    splitElements.forEach((element) => {
      if (element.closest('.hero')) return;
      const chars = Array.from(element.querySelectorAll<HTMLElement>('.char'));
      if (!chars.length) return;
      gsap.fromTo(chars, {
        yPercent: 112,
        rotateZ: 2.2,
        opacity: 0
      }, {
        yPercent: 0,
        rotateZ: 0,
        opacity: 1,
        duration: 0.72,
        stagger: 0.019,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: element,
          start: 'top 86%',
          toggleActions: 'play none none reverse'
        }
      });
    });

    document.querySelectorAll<HTMLElement>('.post-row').forEach((row) => {
      const cover = row.querySelector<HTMLElement>('.post-row__cover');
      const pieces = row.querySelectorAll<HTMLElement>('.post-row__meta, .post-row__title, .post-row__description, .post-row__tags');
      gsap.set(row, { autoAlpha: 0, y: 22 });
      if (cover) gsap.set(cover, { clipPath: 'inset(0 0 100% 0)' });

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: row,
          start: 'top 90%',
          toggleActions: 'play none none reverse'
        }
      });
      timeline.to(row, { autoAlpha: 1, y: 0, duration: 0.62, ease: 'expo.out' });
      if (cover) {
        timeline.to(cover, {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.78,
          ease: 'power3.inOut'
        }, 0.04);
      }
      timeline.from(pieces, {
        y: 10,
        autoAlpha: 0,
        duration: 0.42,
        stagger: 0.038,
        ease: 'power2.out'
      }, 0.1);
    });

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.querySelectorAll<HTMLElement>('[data-post-card]').forEach((card) => {
        const frame = card.querySelector<HTMLElement>('.post-row__cover-link');
        if (!frame) return;
        gsap.set(frame, { transformPerspective: 760 });
        const rotateX = gsap.quickTo(frame, 'rotationX', { duration: 0.5, ease: 'power3.out' });
        const rotateY = gsap.quickTo(frame, 'rotationY', { duration: 0.5, ease: 'power3.out' });
        card.addEventListener('pointermove', (event: PointerEvent) => {
          const bounds = frame.getBoundingClientRect();
          rotateX((0.5 - (event.clientY - bounds.top) / bounds.height) * 7);
          rotateY(((event.clientX - bounds.left) / bounds.width - 0.5) * 10);
        }, { signal: events.signal, passive: true });
        card.addEventListener('pointerleave', () => {
          rotateX(0);
          rotateY(0);
        }, { signal: events.signal, passive: true });
      });
    }

    document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((element) => {
      gsap.fromTo(element, { y: 20, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        duration: 0.62,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: element,
          start: 'top 90%',
          toggleActions: 'play none none reverse'
        }
      });
    });

    // Follow-through for the parts of the article header that stay local to
    // the page. They arrive just after the shared cover/title/index land, so
    // the header never looks pre-populated during the flight.
    const articleHero = document.querySelector<HTMLElement>('.article-hero');
    if (articleHero) {
      gsap.from(articleHero.querySelectorAll<HTMLElement>('.article-hero__description, .article-hero__tags .tag'), {
        y: 16,
        autoAlpha: 0,
        duration: 0.52,
        stagger: 0.04,
        ease: 'power3.out',
        delay: 0.06
      });
    }

    // Shared route elements must never run their own entrance during a view
    // transition; the transition owns their opacity, geometry and timing.
    document.querySelectorAll<HTMLElement>('.prose h2, .prose blockquote').forEach((element) => {
      gsap.from(element, {
        y: 22,
        autoAlpha: 0,
        duration: 0.65,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: element,
          start: 'top 88%',
          toggleActions: 'play none none reverse'
        }
      });
    });

    gsap.utils.toArray<HTMLElement>('.article-toc a').forEach((link, index) => {
      gsap.from(link, {
        x: -8,
        autoAlpha: 0,
        duration: 0.35,
        delay: index * 0.035,
        ease: 'power2.out'
      });
    });

    requestAnimationFrame(() => ScrollTrigger.refresh());
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
    }
  });

  return () => {
    events.abort();
    context.revert();
  };
}
