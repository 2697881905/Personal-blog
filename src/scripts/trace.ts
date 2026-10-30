import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motionEnabled } from './motion-control';

gsap.registerPlugin(ScrollTrigger);

const STAGES = ['queued', 'routing', 'transaction', 'querying', 'complete'];
const CONSOLE_STATES = ['waiting for request', 'validating contract', 'service transaction', 'database roundtrip', 'response committed'];

export function initTrace(): () => void {
  const section = document.querySelector<HTMLElement>('[data-trace]');
  if (!section || !motionEnabled()) {
    section?.classList.remove('is-animated');
    return () => {};
  }

  const nodes = Array.from(section.querySelectorAll<HTMLElement>('[data-trace-node]'));
  const lines = Array.from(section.querySelectorAll<HTMLElement>('[data-trace-line]'));
  const fill = section.querySelector<HTMLElement>('[data-trace-fill]');
  const pulse = section.querySelector<HTMLElement>('[data-trace-pulse]');
  const track = section.querySelector<HTMLElement>('.trace-track');
  const index = section.querySelector<HTMLElement>('[data-trace-index]');
  const status = section.querySelector<HTMLElement>('[data-trace-status]');
  const consoleStatus = section.querySelector<HTMLElement>('[data-trace-console-status]');
  if (!nodes.length || !lines.length || !fill || !pulse || !track) return () => {};

  section.classList.add('is-animated');
  let lastStage = -1;

  const context = gsap.context(() => {
    gsap.set(nodes, { opacity: 0.28, borderColor: 'rgba(234,248,220,0.11)' });
    gsap.set(nodes[0], { opacity: 1, borderColor: 'rgba(215,255,84,0.6)' });
    gsap.set(lines, { opacity: 0.28 });
    gsap.set(lines[0], { opacity: 1 });
    gsap.set(fill, { scaleX: 0 });
    gsap.set(pulse, { opacity: 0 });

    const timeline = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.9,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const stage = Math.min(4, Math.floor(self.progress * 5));
          if (stage === lastStage) return;
          lastStage = stage;
          if (index) index.textContent = `0${stage + 1}`;
          if (status) status.textContent = STAGES[stage];
          if (consoleStatus) consoleStatus.textContent = CONSOLE_STATES[stage];
        }
      }
    });

    timeline
      .to(fill, { scaleX: 1 }, 0)
      .to(pulse, { opacity: 1, duration: 0.03 }, 0)
      .to(pulse, { x: () => track.clientWidth, duration: 1 }, 0);

    nodes.forEach((node, stage) => {
      const at = stage * 0.2;
      timeline.to(node, {
        opacity: 1,
        borderColor: 'rgba(215,255,84,0.6)',
        duration: 0.09
      }, at);
      if (stage > 0) {
        timeline.to(nodes[stage - 1], {
          opacity: 0.52,
          borderColor: 'rgba(234,248,220,0.11)',
          duration: 0.1
        }, at);
      }
      timeline.to(lines[stage], { opacity: 1, duration: 0.08 }, at);
      if (stage > 0) timeline.to(lines[stage - 1], { opacity: 0.28, duration: 0.08 }, at);
    });

    timeline.to({}, { duration: 0.05 });
  }, section);

  requestAnimationFrame(() => ScrollTrigger.refresh());

  return () => {
    context.revert();
    section.classList.remove('is-animated');
    gsap.set([...nodes, ...lines, fill, pulse], { clearProps: 'all' });
  };
}
