import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

const media = window.matchMedia('(prefers-color-scheme: dark)');

const resolve = (mode: ThemeMode) =>
  mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;

function apply(mode: ThemeMode) {
  const theme = resolve(mode);
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#1A1D20' : '#3F7360');
}

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

// El nombre 'sanfefer-theme' lo lee también el script de index.html.
export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => {
        apply(mode);
        set({ mode });
      },
    }),
    { name: 'sanfefer-theme', onRehydrateStorage: () => (state) => state && apply(state.mode) },
  ),
);

media.addEventListener('change', () => {
  if (useTheme.getState().mode === 'system') apply('system');
});

export const resolvedTheme = () => resolve(useTheme.getState().mode);
