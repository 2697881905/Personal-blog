import profile from '../data/profile.json';

const responses: Record<string, string[]> = {
  help: ['whoami      identify the current user', 'now         what I am working on', 'stack       daily tools', 'notes       open the notes archive', 'projects    jump to selected work', 'clear       clear this session'],
  whoami: [`matcha / ${profile.title}`, `${profile.location} · UTC+8`, 'building reliable APIs and careful interfaces'],
  pwd: ['/home/matcha/engineering-notes'],
  now: [profile.now],
  stack: ['Java · Spring Boot · MyBatis-Plus · MySQL', 'Redis · ArkTS · HarmonyOS · Express · Prisma', 'Astro · Vue · Docker · Linux'],
  'ls': ['notes/    projects/    now.md    stack.txt'],
  sudo: ['matcha is not in the sudoers file. This incident has been logged.']
};

export function initTerminal(): () => void {
  const terminal = document.querySelector<HTMLElement>('[data-terminal]');
  if (!terminal) return () => {};
  const form = terminal.querySelector<HTMLFormElement>('[data-terminal-form]');
  const input = terminal.querySelector<HTMLInputElement>('[data-terminal-input]');
  const output = terminal.querySelector<HTMLElement>('[data-terminal-output]');
  if (!form || !input || !output) return () => {};

  const events = new AbortController();
  const history: string[] = [];
  let historyIndex = 0;

  const appendLine = (text: string, modifier = '') => {
    const line = document.createElement('p');
    line.className = `terminal-line terminal-dynamic${modifier ? ` ${modifier}` : ''}`;
    line.textContent = text;
    output.appendChild(line);
  };

  const run = (raw: string) => {
    const command = raw.trim();
    if (!command) return;
    history.push(command);
    historyIndex = history.length;
    appendLine(`❯ ${command}`);
    input.value = '';

    if (command === 'clear') {
      output.replaceChildren();
      return;
    }
    if (command === 'notes') {
      appendLine('opening ./notes ...', 'terminal-output');
      document.querySelector<HTMLAnchorElement>('.post-row__title-link')?.click();
      return;
    }
    if (command === 'projects') {
      appendLine('cd ~/projects', 'terminal-output');
      document.getElementById('projects')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
      return;
    }
    const lines = responses[command];
    if (lines) {
      lines.forEach((line) => appendLine(line, 'terminal-output'));

    } else {
      appendLine(`zsh: command not found: ${command}`, 'terminal-output terminal-error');
      appendLine("type 'help' for available commands", 'terminal-output');
    }
    terminal.scrollTop = terminal.scrollHeight;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    run(input.value);
  }, { signal: events.signal });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' && history.length) {
      event.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] || '';
    }
    if (event.key === 'ArrowDown' && history.length) {
      event.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || '';
    }
  }, { signal: events.signal });

  terminal.querySelectorAll<HTMLButtonElement>('[data-terminal-run]').forEach((button) => {
    button.addEventListener('click', () => {
      run(button.dataset.terminalRun || '');
      input.focus();
    }, { signal: events.signal });
  });

  terminal.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a, button, input')) return;
    input.focus();
  }, { signal: events.signal });

  return () => events.abort();
}
