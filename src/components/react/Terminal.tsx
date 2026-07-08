import { useState, type FormEvent } from 'react';

type Entry = {
  command?: string;
  output: string;
};

const responses: Record<string, string> = {
  help: 'Available commands: help, whoami, java -version',
  whoami: '小白 - Java 后端开发者',
  'java -version': [
    'openjdk version "18.0.2" 2022-07-19',
    'OpenJDK Runtime Environment (build 18.0.2+9)',
    'OpenJDK 64-Bit Server VM (build 18.0.2+9, mixed mode)'
  ].join('\n')
};

export default function Terminal() {
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<Entry[]>([
    { output: 'portfolio shell initialized' }
  ]);

  const runCommand = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const command = input.trim();

    if (!command) {
      return;
    }

    const output = responses[command] ?? `command not found: ${command}`;
    setEntries((current) => [...current, { command, output }]);
    setInput('');
  };

  return (
    <section className="liquid-surface liquid-surface-strong min-h-[300px] rounded-2xl p-4 font-mono text-sm text-[#cfd6df]">
      <div className="liquid-divider mb-4 flex items-center gap-2 border-b pb-3">
        <span className="h-3 w-3 rounded-full bg-[#ff7b72]" />
        <span className="h-3 w-3 rounded-full bg-[#d29922]" />
        <span className="h-3 w-3 rounded-full bg-[#3fb950]" />
        <span className="ml-2 text-xs text-muted">terminal</span>
      </div>

      <div className="space-y-3 whitespace-pre-wrap">
        {entries.map((entry, index) => (
          <div key={`${entry.command ?? 'boot'}-${index}`}>
            {entry.command ? <div className="text-accent">$ {entry.command}</div> : null}
            <div>{entry.output}</div>
          </div>
        ))}
      </div>

      <form className="mt-4 flex items-center gap-2" onSubmit={runCommand}>
        <label className="text-accent" htmlFor="terminal-input">
          $
        </label>
        <input
          id="terminal-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[#cfd6df] outline-none placeholder:text-[#484f58]"
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </section>
  );
}
