import { useState } from 'react';
import { Check } from 'lucide-react';
import { PALETTES, applyPalette, getPalette, type PaletteId } from '../lib/palette';
import { cn } from '../lib/utils';

/**
 * Галерея палитр: свотчи 600/500/300 + подпись (те же классы, что в оригинале).
 */
export function PalettePicker({ testIdPrefix = 'palette' }: { testIdPrefix?: string }) {
  const [current, setCurrent] = useState<PaletteId>(() => getPalette());

  function pick(id: PaletteId) {
    setCurrent(id);
    applyPalette(id);
  }

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Цветовая палитра">
      {PALETTES.map(({ id, label, swatch }) => {
        const active = current === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => pick(id)}
            aria-pressed={active}
            data-testid={`${testIdPrefix}-${id}`}
            className={cn(
              'relative flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-[var(--radius-m)] border px-2 py-2 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-300)]',
              active
                ? 'border-transparent bg-[var(--color-primary-100)] text-[var(--color-primary-700)] ring-2 ring-[var(--color-primary-500)] dark:bg-[var(--color-primary-800)]/40 dark:text-[var(--color-fg)]'
                : 'border-[var(--color-border-color)] text-[var(--color-muted-fg)] hover:text-[var(--color-fg)]',
            )}
          >
            {active && (
              <Check
                className="absolute right-1.5 top-1.5 size-3.5 text-[var(--color-primary-600)]"
                aria-hidden="true"
              />
            )}
            <span className="flex overflow-hidden rounded-full ring-1 ring-black/10" aria-hidden="true">
              {swatch.map((c) => (
                <span key={c} className="h-5 w-5" style={{ backgroundColor: c }} />
              ))}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
