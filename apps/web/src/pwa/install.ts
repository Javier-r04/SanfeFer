import { create } from 'zustand';

/** Evento de Chrome/Edge/Android para ofrecer la instalación (no está en los tipos del DOM). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  prompt: BeforeInstallPromptEvent | null;
  installed: boolean;
}

const useInstallStore = create<InstallState>(() => ({
  prompt: null,
  installed: false,
}));

// Se escucha desde que carga la app: el navegador dispara el evento una sola vez.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstallStore.setState({ prompt: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () =>
    useInstallStore.setState({ prompt: null, installed: true }),
  );
}

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** iPhone/iPad en Safari: no hay botón de instalar, se hace desde "Compartir". */
const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export function useInstall() {
  const { prompt, installed } = useInstallStore();
  const standalone = isStandalone();
  return {
    /** Chrome/Edge/Android: se puede abrir el diálogo nativo. */
    canPrompt: !!prompt && !standalone && !installed,
    /** iOS sin instalar: hay que mostrar las instrucciones. */
    needsIOSHelp: isIOS() && !standalone && !installed,
    install: async () => {
      if (!prompt) return false;
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      useInstallStore.setState({ prompt: null, installed: outcome === 'accepted' });
      return outcome === 'accepted';
    },
  };
}
