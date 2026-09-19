import { useEffect, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '../ui/button';

type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_KEY = 'robbo.theme';

export function getThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const v = localStorage.getItem(THEME_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function applyThemeMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_KEY, mode);
  const systemDark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', mode === 'dark' || (mode === 'system' && systemDark));
}

export function initTheme(): void {
  try {
    applyThemeMode(getThemeMode());
  } catch {
    // localStorage заблокирован — остаёмся на системной теме
  }
}

/** Упрощённый ThemeToggle: кнопка Sun/Moon + dropdown светлая/тёмная/системная. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => getThemeMode());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getThemeMode() === 'system') {
        document.documentElement.classList.toggle('dark', mq.matches);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function pick(mode: ThemeMode) {
    setTheme(mode);
    applyThemeMode(mode);
    setOpen(false);
  }

  const icon =
    theme === 'dark' ? (
      <Moon className="size-4" />
    ) : theme === 'light' ? (
      <Sun className="size-4" />
    ) : (
      <Monitor className="size-4" />
    );

  return (
    <span className="relative inline-flex">
      <Button variant="ghost" size="icon" aria-label="Тема оформления" onClick={() => setOpen((v) => !v)}>
        {icon}
      </Button>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <span className="absolute right-0 top-11 z-50 min-w-40 overflow-hidden rounded-[var(--radius-m)] border border-[var(--color-border-color)] bg-[var(--color-popover)] p-1 shadow-[var(--shadow-hover)]">
            {(
              [
                ['light', 'Светлая', Sun],
                ['dark', 'Тёмная', Moon],
                ['system', 'Системная', Monitor],
              ] as [ThemeMode, string, typeof Sun][]
            ).map(([mode, label, Icon]) => (
              <button
                key={mode}
                type="button"
                onClick={() => pick(mode)}
                className="flex w-full items-center gap-2 rounded-[calc(var(--radius-s)-2px)] px-2.5 py-1.5 text-sm text-[var(--color-fg)] hover:bg-[var(--color-muted-fg)/10]"
              >
                <Icon className="size-4" />
                {label}
                {theme === mode && <Check className="ml-auto size-4" />}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  );
}
