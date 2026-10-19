import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ComingSoon } from '@/features/common/ComingSoon';
import { useSession } from '@/features/auth/api';

export function PosPlaceholderPage({
  title,
  phase,
  description,
}: {
  title: string;
  phase: number;
  description: string;
}) {
  const { data: user } = useSession();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted">Hola, {user?.name.split(' ')[0]}</p>
        <ThemeToggle variant="icon" />
      </div>
      <ComingSoon title={title} phase={phase} description={description} />
    </div>
  );
}
