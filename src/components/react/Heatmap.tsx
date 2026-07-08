import { type CSSProperties, useMemo } from 'react';

const colors = [
  '#ebedf0',
  '#9be9a8',
  '#40c463',
  '#30a14e',
  '#216e39',
];

const weekCount = 52;
const notes = ['B', 'A', 'G', 'F', 'E', 'D', 'C'];
const impactPoint = 0.61;
const fallingChance = 0.1;
const fallCycleRange = [5.5, 8.5] as const;
const whiteKeys = Array.from({ length: weekCount }, (_, index) => {
  const note = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][index % 7];

  return {
    note,
    hasBlackKey: !['E', 'B'].includes(note),
  };
});

type NoteCell = {
  cycle: number;
  delay: number;
  fallDistance: number;
  isFalling: boolean;
  pulseDelay: number;
  value: number;
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

export default function Heatmap() {
  const columns = useMemo<NoteCell[][]>(
    () =>
      Array.from({ length: weekCount }, () =>
        Array.from({ length: notes.length }, (_, dayIndex) => {
          const cycle = randomBetween(...fallCycleRange);
          const delay = randomBetween(0, cycle);
          const value = Math.floor(Math.random() * 5);
          const isFalling = value > 0 && Math.random() < fallingChance;

          return {
            cycle,
            delay,
            fallDistance: 44 + (notes.length - 1 - dayIndex) * 17,
            isFalling,
            pulseDelay: delay + cycle * impactPoint,
            value,
          };
        })
      ),
    []
  );

  return (
    <section className="py-1" aria-label="贡献琴卷">
      <div className="pb-1">
        <div className="w-full">
          <div className="grid items-stretch grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:gap-3">
            <div className="hidden h-full grid-rows-7 gap-[2px] sm:grid">
              {notes.map((note) => {
                const isBlackTone = ['A', 'G', 'D'].includes(note);

                return (
                  <span
                    key={note}
                    className={[
                      'flex h-full items-center justify-center rounded-l-lg rounded-r-sm border text-[10px] font-semibold leading-none',
                      isBlackTone
                        ? 'border-[#111827] bg-black text-white shadow-inner shadow-white/10'
                        : 'border-[#d0d7de] bg-white text-[#0d1117] shadow-inner shadow-white',
                    ].join(' ')}
                    style={{
                      transform: isBlackTone ? 'translateX(0.35rem)' : undefined,
                      width: isBlackTone ? '2.1rem' : '2.55rem',
                    }}
                  >
                    {note}
                  </span>
                );
              })}
            </div>

            <div className="relative">
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
              <div
                className="grid grid-flow-col grid-rows-7 gap-[2px]"
                style={{ gridTemplateColumns: `repeat(${weekCount}, minmax(0, 1fr))` }}
              >
                {columns.map((week, weekIndex) =>
                  week.map((cell, dayIndex) => (
                    <span
                      key={`${weekIndex}-${dayIndex}`}
                      className={[
                        cell.isFalling ? 'contribution-note' : '',
                        'aspect-square w-full min-w-0 rounded-[2px] border ring-1 ring-black/20 transition duration-200 hover:border-white/55',
                      ].join(' ')}
                      style={{
                        '--fall-cycle': `${cell.cycle}s`,
                        '--fall-delay': `${cell.delay}s`,
                        '--fall-distance': `${cell.fallDistance}px`,
                        '--note-glow': colors[Math.max(cell.value, 1)],
                        backgroundColor: colors[cell.value],
                        borderColor: cell.value === 0 ? '#d0d7de' : colors[cell.value],
                        boxShadow: 'none',
                      } as CSSProperties}
                      aria-hidden="true"
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:gap-3">
            <span aria-hidden="true" className="hidden sm:block" />
            <div className="relative h-10 overflow-hidden rounded-xl border border-[#111827] shadow-lg shadow-black/30 sm:h-11">
              <div
                className="grid h-full gap-[2px]"
                style={{ gridTemplateColumns: `repeat(${weekCount}, minmax(0, 1fr))` }}
              >
                {whiteKeys.map((key, index) => (
                  <span
                    key={`${key.note}-${index}`}
                    className="piano-key relative flex items-end justify-center bg-white pb-1 text-[8px] font-semibold text-[#0d1117] shadow-inner shadow-[#d0d7de]"
                  >
                    {index % 7 === 0 ? key.note : ''}
                    {columns[index]
                      .filter((cell) => cell.isFalling)
                      .map((cell, pulseIndex) => (
                        <span
                          key={`${key.note}-${index}-pulse-${pulseIndex}`}
                          className="piano-key-hit"
                          style={{
                            '--press-cycle': `${cell.cycle}s`,
                            '--press-delay': `${cell.pulseDelay}s`,
                            '--press-color': colors[Math.max(cell.value, 1)],
                          } as CSSProperties}
                          aria-hidden="true"
                        />
                      ))}
                    {key.hasBlackKey ? (
                      <span className="absolute -right-[34%] top-0 z-10 h-[62%] w-[62%] rounded-b-[4px] border border-[#111827] bg-black shadow-lg shadow-black/60" />
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
