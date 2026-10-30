import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { DUR, EASE, motionScale, prefersReducedMotion } from '../animations/anim.config';

gsap.registerPlugin(Flip);

type OverlayKind = 'project' | 'qr' | 'lightbox' | 'code';

interface OpenOptions {
  kind: OverlayKind;
  title: string;
  content?: HTMLElement;
  expandClass?: string;
}

interface ActiveOverlay {
  source: HTMLElement;
  placeholder: HTMLElement;
  root: HTMLElement;
  kind: OverlayKind;
  expandClass?: string;
  targets: HTMLElement[];
  previousFocus: HTMLElement | null;
  previousOverflow: string;
  inertElements: HTMLElement[];
}

const FLIP_PROPS = 'borderRadius,backgroundColor,borderColor,letterSpacing';

function clearFlipStyles(targets: HTMLElement[]): void {
  targets.forEach((target) => {
    target.style.willChange = 'auto';
  });
}

/**
 * A reversible shared-element overlay. The original node is moved into the
 * overlay and later returned to its exact DOM position; no visual clone is used.
 */
export class FlipOverlay {
  private active: ActiveOverlay | null = null;

  open(source: HTMLElement, options: OpenOptions): void {
    if (this.active) this.close(true);

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const rect = source.getBoundingClientRect();
    const placeholder = document.createElement(source.tagName === 'SPAN' ? 'span' : 'div');
    placeholder.className = 'shared-placeholder';
    placeholder.style.display = source.tagName === 'SPAN' ? 'inline-block' : 'block';
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;
    source.parentElement?.insertBefore(placeholder, source);

    const targets = [source, ...Array.from(source.querySelectorAll<HTMLElement>('[data-shared-id]'))];
    const state = Flip.getState(targets, { props: FLIP_PROPS });
    const { root, backdrop, sourceStage, contentStage, closeButton } = this.build(options);

    if (options.expandClass) source.classList.add(options.expandClass);
    sourceStage.appendChild(source);
    if (options.content) contentStage.appendChild(options.content);
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    const inertElements = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        element !== root &&
        !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName)
    );
    inertElements.forEach((element) => { element.inert = true; });

    this.active = {
      source, placeholder, root, kind: options.kind, expandClass: options.expandClass, targets,
      previousFocus, previousOverflow, inertElements
    };

    const close = () => this.close();
    closeButton.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    root.addEventListener('keydown', (event) => this.onKeydown(event));
    closeButton.focus({ preventScroll: true });

    if (prefersReducedMotion()) {
      gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: EASE.out });
      return;
    }

    gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: DUR.micro, ease: EASE.out });
    if (options.content) {
      gsap.fromTo(options.content, { opacity: 0 }, { opacity: 1, duration: DUR.micro, delay: 0.06, ease: EASE.out });
    }

    targets.forEach((target) => { target.style.willChange = 'transform'; });
    Flip.from(state, {
      targets,
      duration: (options.kind === 'project' ? 0.4 : 0.3) * motionScale(),
      ease: EASE.expo,
      absolute: true,
      nested: true,
      prune: true,
      onComplete: () => clearFlipStyles(targets)
    });

    if (options.kind === 'project') {
      const details = source.querySelectorAll<HTMLElement>('.project-card__details li, .project-card__actions .text-button');
      gsap.from(details, {
        y: 16,
        autoAlpha: 0,
        duration: 0.42,
        stagger: 0.045,
        delay: 0.16,
        ease: 'power3.out',
        overwrite: true
      });
    }
  }

  close(instant = false): void {
    if (!this.active) return;
    const active = this.active;
    this.active = null;
    const { source, placeholder, root, kind, targets, expandClass, previousFocus, previousOverflow, inertElements } = active;

    Flip.killFlipsOf(targets);
    gsap.killTweensOf(targets);
    if (kind === 'project') {
      gsap.to(source.querySelectorAll('.project-card__details li, .project-card__actions .text-button'), {
        autoAlpha: 0,
        y: 8,
        duration: 0.12,
        ease: 'power2.in',
        overwrite: true
      });
    }
    const state = Flip.getState(targets, { props: FLIP_PROPS });

    if (expandClass) source.classList.remove(expandClass);
    placeholder.replaceWith(source);
    root.remove();
    document.body.style.overflow = previousOverflow;
    inertElements.forEach((element) => { element.inert = false; });

    if (!instant && !prefersReducedMotion()) {
      targets.forEach((target) => { target.style.willChange = 'transform'; });
      Flip.from(state, {
        targets,
        duration: 0.28 * motionScale(),
        ease: 'power3.inOut',
        absolute: true,
        nested: true,
        prune: true,
        onComplete: () => clearFlipStyles(targets)
      });
    } else {
      gsap.set(targets, { clearProps: 'transform,position,top,left,width,height,zIndex,opacity' });
      clearFlipStyles(targets);
    }

    if (!instant) previousFocus?.focus({ preventScroll: true });
  }

  private build(options: OpenOptions) {
    const root = document.createElement('div');
    root.className = `shared-overlay shared-overlay--${options.kind}`;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', options.title);

    const backdrop = document.createElement('div');
    backdrop.className = 'shared-overlay__backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'shared-overlay__dialog';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'shared-overlay__close';
    closeButton.setAttribute('aria-label', '关闭');
    closeButton.textContent = '×';

    const header = document.createElement('div');
    header.className = 'shared-overlay__header';
    const iconStage = document.createElement('div');
    iconStage.className = 'shared-overlay__icon-stage';
    const title = document.createElement('h2');
    title.className = 'shared-overlay__title';
    title.textContent = options.title;
    const body = document.createElement('div');
    body.className = 'shared-overlay__body';
    const sourceStage = document.createElement('div');
    const contentStage = document.createElement('div');

    if (options.kind === 'qr') {
      iconStage.appendChild(sourceStage);
      header.append(iconStage, title);
      body.appendChild(contentStage);
      dialog.append(closeButton, header, body);
    } else {
      body.append(sourceStage, contentStage);
      if (options.kind === 'lightbox') {
        header.classList.add('shared-overlay__media-title');
        header.appendChild(title);
        dialog.append(closeButton, header, body);
      } else {
        dialog.append(closeButton, body);
      }
    }

    root.append(backdrop, dialog);
    return { root, backdrop, dialog, sourceStage, contentStage, closeButton };
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key !== 'Tab' || !this.active) return;

    const focusable = Array.from(this.active.root.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]'))
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
  }
}
