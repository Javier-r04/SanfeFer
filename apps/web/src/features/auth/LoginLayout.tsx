import type { ReactNode } from 'react';
import { LogoMark, TejidoBand } from '@/components/ui/Brand';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { InstallButton } from '@/pwa/InstallButton';

export function LoginLayout({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TejidoBand />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pt-3 pb-3">
        <div className="flex items-center justify-end gap-2">
          <InstallButton className="mr-auto -ml-3" />
          <ThemeToggle variant="icon" />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <LogoMark className="size-14 rounded-2xl" />
          <h1 className="font-display text-[34px] font-extrabold tracking-tight">SanfeFer</h1>
          <p className="text-[15px] text-muted">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
