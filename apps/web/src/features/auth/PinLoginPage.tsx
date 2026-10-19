import { PIN_REGEX } from '@sanfefer/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Avatar } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { PinDots, PinPad } from '@/components/ui/PinPad';
import { Spinner } from '@/components/ui/Spinner';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { homePath, useLoginPin, useLoginUsers } from './api';
import { LoginLayout } from './LoginLayout';

const LAST_USER_KEY = 'sanfefer-last-user';
const MAX_PIN = 6;

function readLastUser() {
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export function PinLoginPage() {
  const users = useLoginUsers();
  const login = useLoginPin();
  const navigate = useNavigate();
  const location = useLocation();
  const [selected, setSelected] = useState<string | null>(readLastUser);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedUser = users.data?.find((u) => u.username === selected);

  const submit = useCallback(() => {
    if (!selectedUser || !PIN_REGEX.test(pin) || login.isPending) return;
    login.mutate(
      { username: selectedUser.username, pin },
      {
        onSuccess: ({ user }) => {
          try {
            localStorage.setItem(LAST_USER_KEY, user.username);
          } catch {
            // Sin almacenamiento local: solo no se recuerda el último usuario.
          }
          const from = (location.state as { from?: string } | null)?.from;
          navigate(from && from !== '/' ? from : homePath(user.role), { replace: true });
        },
        onError: (err) => {
          setError(errorMessage(err));
          setPin('');
        },
      },
    );
  }, [selectedUser, pin, login, location.state, navigate]);

  const addDigit = useCallback((d: string) => {
    setError(null);
    setPin((p) => (p.length < MAX_PIN ? p + d : p));
  }, []);
  const removeDigit = useCallback(() => setPin((p) => p.slice(0, -1)), []);

  // Teclado físico (PC o tablet con teclado).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedUser || (e.target as HTMLElement).closest('input, textarea')) return;
      if (/^\d$/.test(e.key)) addDigit(e.key);
      else if (e.key === 'Backspace') removeDigit();
      else if (e.key === 'Enter') submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedUser, addDigit, removeDigit, submit]);

  return (
    <LoginLayout subtitle="¿Quién atiende hoy?">
      {users.isPending ? (
        <div className="grid place-items-center py-8 text-primary">
          <Spinner label="Cargando usuarios…" />
        </div>
      ) : users.error ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p role="alert" className="font-semibold text-danger-ink">
            {errorMessage(users.error)}
          </p>
          <Button onClick={() => void users.refetch()}>Reintentar</Button>
        </div>
      ) : users.data.length === 0 ? (
        <p className="text-center text-muted">
          Aún no hay vendedores. Entra como administrador para crearlos.
        </p>
      ) : (
        <>
          <div
            role="radiogroup"
            aria-label="Usuario"
            className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2"
          >
            {users.data.map((u) => {
              const active = u.username === selected;
              return (
                <button
                  key={u.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setSelected(u.username);
                    setPin('');
                    setError(null);
                  }}
                  className={cn(
                    'flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-[13px] font-semibold',
                    active
                      ? 'border-2 border-primary bg-primary-soft'
                      : 'border border-border bg-surface',
                  )}
                >
                  <Avatar initials={u.initials} />
                  <span className="w-full truncate">{u.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          {selectedUser ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-2.5">
                <p className="text-sm text-muted">
                  PIN de <strong className="text-text">{selectedUser.name.split(' ')[0]}</strong>
                </p>
                <PinDots length={pin.length} max={MAX_PIN} error={!!error} />
                <p className="sr-only" aria-live="polite">
                  {pin.length} dígitos ingresados
                </p>
                <p
                  role="alert"
                  className="min-h-5 text-center text-sm font-semibold text-danger-ink"
                >
                  {error}
                </p>
              </div>
              <PinPad
                onDigit={addDigit}
                onDelete={removeDigit}
                onSubmit={submit}
                canSubmit={PIN_REGEX.test(pin)}
                disabled={login.isPending}
              />
            </div>
          ) : (
            <p className="text-center text-muted">Toca tu nombre para ingresar tu PIN.</p>
          )}
        </>
      )}

      <Link
        to="/login/admin"
        className="mt-auto p-2 text-center text-[15px] font-semibold text-primary-ink underline-offset-4 hover:underline"
      >
        Entrar como administrador
      </Link>
    </LoginLayout>
  );
}
