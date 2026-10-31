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
  dialog: HTMLElement;
  kind: OverlayKind;
  expandClass?: string;
  targets: HTMLElement[];
  previousFocus: HTMLElement | null;
  previousOverflow: string;
  inertElements: HTMLElement[];
  sheetCleanup: (() => void) | null;
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
    const { root, backdrop, dialog, sourceStage, contentStage, closeButton } = this.build(options);

    if (options.kind === 'project' && window.matchMedia('(hover: none) and (max-width: 700px)').matches) {
      root.classList.add('is-sheet');
    }

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
      source, placeholder, root, dialog, kind: options.kind, expandClass: options.expandClass, targets,
      previousFocus, previousOverflow, inertElements, sheetCleanup: null
    };

    const close = () => this.close();
    closeButton.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    root.addEventListener('keydown', (event) => this.onKeydown(event));
    closeButton.focus({ preventScroll: true });

    if (prefersReducedMotion()) {
      gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: EASE.out });
      this.attachSheetDrag(dialog, root);
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
      onComplete: () => {
        clearFlipStyles(targets);
        this.attachSheetDrag(dialog, root);
      }
    });

    if (root.classList.contains('is-sheet')) {
      const chrome = dialog.querySelectorAll<HTMLElement>('.shared-overlay__grab');
      gsap.fromTo(chrome, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.24, delay: 0.2, ease: EASE.out });
    }

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

    active.sheetCleanup?.();
    Flip.killFlipsOf(targets);
    gsap.killTweensOf(targets);
    const actionButtons = source.querySelectorAll<HTMLElement>('.project-card__actions .text-button');
    const restoreActions = () => {
      gsap.set(actionButtons, { clearProps: 'opacity,visibility,transform' });
    };
    const restoreFocus = () => {
      if (instant || this.active) return;
      previousFocus?.focus({ preventScroll: true });
    };
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
        onComplete: () => {
          clearFlipStyles(targets);
          restoreActions();
          restoreFocus();
        }
      });
    } else {
      gsap.set(targets, { clearProps: 'transform,position,top,left,width,height,zIndex,opacity' });
      clearFlipStyles(targets);
      restoreActions();
      restoreFocus();
    }
  }

  private attachSheetDrag(dialog: HTMLElement, root: HTMLElement): void {
    const active = this.active;
    if (!active || active.dialog !== dialog || !root.classList.contains('is-sheet')) return;

    const grab = dialog.querySelector<HTMLElement>('.shared-overlay__grab');
    if (!grab) return;
    const backdrop = root.querySelector<HTMLElement>('.shared-overlay__backdrop');
    const controller = new AbortController();
    const dismissDistance = Math.min(160, window.innerHeight * 0.22);
    let startY = 0;
    let startTime = 0;
    let delta = 0;
    let tracking = false;

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || !event.isPrimary) return;
      tracking = true;
      startY = event.clientY;
      startTime = performance.now();
      delta = 0;
      root.classList.add('is-sheet-dragging');
      gsap.killTweensOf(dialog);
      try {
        grab.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic or cancelled pointers cannot be captured; dragging still works.
      }
      event.preventDefault();
    };

    const onMove = (event: PointerEvent) => {
      if (!tracking) return;
      delta = Math.max(0, event.clientY - startY);
      const progress = Math.min(delta / dismissDistance, 1);
      gsap.set(dialog, { y: delta, scale: 1 - progress * 0.02 });
      if (backdrop) gsap.set(backdrop, { opacity: 1 - progress * 0.35 });
      event.preventDefault();
    };

    const finish = (event: PointerEvent) => {
      if (!tracking) return;
      tracking = false;
      root.classList.remove('is-sheet-dragging');
      if (grab.hasPointerCapture(event.pointerId)) grab.releasePointerCapture(event.pointerId);

      const elapsed = Math.max(1, performance.now() - startTime);
      const velocity = delta / elapsed;
      if (delta > dismissDistance || velocity > 0.55) {
        this.close();
        return;
      }

      gsap.to(dialog, { y: 0, scale: 1, duration: 0.42, ease: 'power3.out', overwrite: true });
      if (backdrop) gsap.to(backdrop, { opacity: 1, duration: 0.3, overwrite: true });
    };

    grab.addEventListener('pointerdown', onDown, { signal: controller.signal });
    grab.addEventListener('pointermove', onMove, { signal: controller.signal });
    grab.addEventListener('pointerup', finish, { signal: controller.signal });
    grab.addEventListener('pointercancel', finish, { signal: controller.signal });

    active.sheetCleanup = () => {
      controller.abort();
      root.classList.remove('is-sheet-dragging');
      gsap.killTweensOf(dialog);
    };
  }

  private build(options: OpenOptions) {
    const root = document.createElement('div');
    root.className = `shared-overlay shared-overlay--${options.kind}`;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', options.title);
    root.setAttribute('aria-keyshortcuts', 'Escape');

    const backdrop = document.createElement('div');
    backdrop.className = 'shared-overlay__backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'shared-overlay__dialog';

    const grab = document.createElement('div');
    grab.className = 'shared-overlay__grab';
    grab.setAttribute('aria-hidden', 'true');
    const grip = document.createElement('span');
    grab.appendChild(grip);
    dialog.appendChild(grab);

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
      .filter((element) => !element.hasAttribute('disabled') && element.getClientRects().length > 0);
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
