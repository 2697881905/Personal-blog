import profile from '../data/profile.json';

const responses: Record<string, string[]> = {
  help: [
    'whoami      identify the current user',
    'now         what I am working on',
    'stack       daily tools',
    'notes       open the notes archive',
    'projects    jump to selected work',
    'neofetch    system info, obviously',
    'hdc         device connector · list targets / shell',
    'hilog       recent distributed logs',
    'bus         soft-bus discovery broadcast',
    'uname       kernel identity',
    'cat now.md  print current focus',
    'github      open the GitHub profile',
    'date        current date/time',
    'clear       clear this session'
  ],
  whoami: [`matcha / ${profile.title}`, `${profile.timezone} · UTC+8`, 'ArkTS / ArkUI · device-first'],
  pwd: ['/home/matcha/engineering-notes'],
  now: [profile.now],
  stack: ['ArkTS · HarmonyOS NEXT · ArkUI · DevEco Studio', 'TypeScript · Java · Spring Boot · MySQL', 'Redis · Express · Prisma · Astro · Docker'],
  'ls': ['notes/    projects/    now.md    stack.txt'],
  sudo: ['matcha is not in the sudoers file. This incident has been logged.']
};

const NEOFETCH: string[] = [
  '<span class="neo-logo">   ( (        </span>  <span class="neo-user">matcha</span><span class="neo-at">@</span><span class="neo-user">blog</span>',
  '<span class="neo-logo">    ) )       </span>  <span class="neo-at">──────────────────</span>',
  '<span class="neo-logo">  ........    </span>  <span class="neo-k">os</span><span class="neo-at">:</span><span class="neo-v"> OpenHarmony 5.0 · API 12</span>',
  '<span class="neo-logo">  |      |]   </span>  <span class="neo-k">ark</span><span class="neo-at">:</span><span class="neo-v"> ArkTS · ArkUI · ArkCompiler</span>',
  '<span class="neo-logo">  \\      /    </span>  <span class="neo-k">shell</span><span class="neo-at">:</span><span class="neo-v"> zsh 5.9 · hdc</span>',
  '<span class="neo-logo">   `----&#39;    </span>  <span class="neo-k">uptime</span><span class="neo-at">:</span><span class="neo-v"> still shipping</span>',
  '<span class="neo-logo">              </span>  <span class="neo-k">device</span><span class="neo-at">:</span><span class="neo-v"> phone · pad · watch — one codebase</span>',
  '<span class="neo-logo">              </span>  <span class="neo-ok">● ● ● ● ● ● ● ●</span>'
];

const HDC_TARGETS: string[] = [
  'Attached devices:',
  '127.0.0.1:5555      emulator-5554     OpenHarmony 5.0.1',
  'WATCH-4-ABC123      wear-device       HarmonyOS 5.0',
  'PAD-GT9-XYZ789      tablet-device     HarmonyOS 5.0',
  '[3 targets attached]'
];

const HILOG_LINES: string[] = [
  '<span class="log-t">08-31 14:09:46.123</span> <span class="log-pid">1234-1234</span> <span class="log-tag">A0c0d0/com.matcha.blog</span> <span class="log-i">I</span> softbus: peer watch-4 discovered, auth ok',
  '<span class="log-t">08-31 14:09:46.321</span> <span class="log-pid">1234-1234</span> <span class="log-tag">A0c0d0/com.matcha.blog</span> <span class="log-d">D</span> arkui: page router → /notes (240ms)',
  '<span class="log-t">08-31 14:09:46.555</span> <span class="log-pid">1234-1234</span> <span class="log-tag">A0c0d0/com.matcha.blog</span> <span class="log-w">W</span> caffeine reservoir at 13% — refill advised'
];

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

  const appendHTML = (html: string, modifier = 'terminal-output') => {
    const line = document.createElement('p');
    line.className = `terminal-line terminal-dynamic${modifier ? ` ${modifier}` : ''}`;
    line.innerHTML = html;
    output.appendChild(line);
  };

  const dispatch = (type: string) => window.dispatchEvent(new CustomEvent(type));

  const scrollToEnd = () => {
    output.scrollTop = output.scrollHeight;
    terminal.scrollTop = terminal.scrollHeight;
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
    if (command === 'neofetch') {
      NEOFETCH.forEach((row) => appendHTML(row));
      scrollToEnd();
      return;
    }
    if (command === 'hdc' || command.startsWith('hdc ')) {
      const args = command.slice(3).trim();
      if (args === 'list targets') {
        HDC_TARGETS.forEach((row) => appendLine(row, 'terminal-output'));
      } else if (args.startsWith('shell')) {
        appendLine('start ability success', 'terminal-output');
        appendLine('uiability: onCreate → onWindowStageCreate → onForeground', 'terminal-output');
        appendLine("hilog: MatchaProfile mood = 'caffeine 87%'", 'terminal-output');
      } else {
        appendLine('usage: hdc list targets | hdc shell <command>', 'terminal-output');
      }
      scrollToEnd();
      return;
    }
    if (command === 'hilog') {
      HILOG_LINES.forEach((row) => appendHTML(row));
      scrollToEnd();
      return;
    }
    if (command === 'bus' || command === 'discover') {
      appendLine('softbus: broadcasting discovery frame ...', 'terminal-output');
      dispatch('matcha:discover');
      appendLine('found 5 peers — phone · pad · watch · audio · iot', 'terminal-output terminal-ok');
      scrollToEnd();
      return;
    }
    if (command === 'uname' || command === 'uname -a') {
      appendLine('MatchaOS 3.1.0-gecko #1 SMP PREEMPT_CAFFEINE x86_64 GNU/Linux', 'terminal-output');
      scrollToEnd();
      return;
    }
    if (command === 'date') {
      appendLine(new Date().toString(), 'terminal-output');
      scrollToEnd();
      return;
    }
    if (command === 'cat now.md' || command === 'cat now') {
      appendLine(profile.now, 'terminal-output');
      scrollToEnd();
      return;
    }
    if (command === 'rm -rf /' || command === 'sudo rm -rf /' || command.startsWith('rm -rf')) {
      appendLine('permission denied: this portfolio is load-bearing.', 'terminal-output terminal-error');
      dispatch('matcha:shake');
      scrollToEnd();
      return;
    }
    if (command === 'github' || command === 'open github') {
      appendLine('opening github.com/2697881905 ...', 'terminal-output');
      window.open('https://github.com/2697881905', '_blank', 'noreferrer');
      scrollToEnd();
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
        behavior: 'smooth',
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
    scrollToEnd();
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
