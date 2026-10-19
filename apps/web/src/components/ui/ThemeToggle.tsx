import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import { resolvedTheme, useTheme, type ThemeMode } from '@/stores/theme';

const options: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: 'light', label: 'Tema claro', Icon: Sun },
  { mode: 'dark', label: 'Tema oscuro', Icon: Moon },
  { mode: 'system', label: 'Según el sistema', Icon: Monitor },
];

/** "segmented": claro / oscuro / sistema. "icon": un botón que alterna claro ↔ oscuro (POS). */
export function ThemeToggle({ variant = 'segmented' }: { variant?: 'segmented' | 'icon' }) {
  const { mode, setMode } = useTheme();

  if (variant === 'icon') {
    const dark = resolvedTheme() === 'dark';
    const Icon = dark ? Sun : Moon;
    return (
      <button
        type="button"
        onClick={() => setMode(dark ? 'light' : 'dark')}
        aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        className="grid size-11 place-items-center rounded-full border-[1.5px] border-border bg-surface"
      >
        <Icon aria-hidden="true" className="size-5" />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema de color"
      className="flex gap-1 rounded-full bg-surface-2 p-1"
    >
      {options.map(({ mode: m, label, Icon }) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          aria-label={label}
          title={label}
          onClick={() => setMode(m)}
          className={cn(
            'grid size-10 place-items-center rounded-full transition',
            mode === m ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
          )}
        >
          <Icon aria-hidden="true" className="size-[18px]" />
        </button>
      ))}
    </div>
  );
}
