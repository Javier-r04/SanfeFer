import { zodResolver } from '@hookform/resolvers/zod';
import { passwordLoginSchema, type PasswordLoginInput } from '@sanfefer/shared';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { errorMessage } from '@/lib/api';
import { homePath, useLoginPassword } from './api';
import { LoginLayout } from './LoginLayout';

export function AdminLoginPage() {
  const login = useLoginPassword();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordLoginInput>({ resolver: zodResolver(passwordLoginSchema) });

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: ({ user }) => {
        const from = (location.state as { from?: string } | null)?.from;
        navigate(from && from !== '/' ? from : homePath(user.role), { replace: true });
      },
    }),
  );

  return (
    <LoginLayout subtitle="Ingreso de administrador">
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5"
      >
        <Field label="Usuario" error={errors.username?.message}>
          {(a) => (
            <Input
              {...a}
              {...register('username')}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
            />
          )}
        </Field>
        <Field label="Contraseña" error={errors.password?.message}>
          {(a) => (
            <Input
              {...a}
              {...register('password')}
              type="password"
              autoComplete="current-password"
            />
          )}
        </Field>
        {login.error ? (
          <p
            role="alert"
            className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-semibold text-danger-ink"
          >
            {errorMessage(login.error)}
          </p>
        ) : null}
        <Button type="submit" size="xl" loading={login.isPending}>
          Entrar
        </Button>
      </form>
      <Link
        to="/login"
        className="mt-auto p-3 text-center text-[15px] font-semibold text-primary-ink underline-offset-4 hover:underline"
      >
        Entrar con PIN
      </Link>
    </LoginLayout>
  );
}
