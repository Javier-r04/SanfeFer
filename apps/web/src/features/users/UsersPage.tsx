import { ROLE_LABELS, type UserDto } from '@sanfefer/shared';
import { KeyRound, LockOpen, Pencil, Plus, Power, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/features/common/ComingSoon';
import { useSession } from '@/features/auth/api';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/stores/toast';
import { useDeleteUser, useUnlockUser, useUpdateUser, useUsers } from './api';
import { UserFormModal } from './UserFormModal';

type Filter = 'active' | 'inactive' | 'all';
type Confirm = { kind: 'toggle' | 'delete'; user: UserDto } | null;

const initialsOf = (name: string) => {
  const [a = '', b = ''] = name.trim().split(/\s+/);
  return (b ? a[0]! + b[0]! : a.slice(0, 2)).toUpperCase();
};

function StatusBadge({ user }: { user: UserDto }) {
  if (!user.active) return <Badge tone="neutral">Inactivo</Badge>;
  if (user.lockedUntil) return <Badge tone="danger">Bloqueado</Badge>;
  return <Badge tone="primary">Activo</Badge>;
}

function AccessChips({ user }: { user: UserDto }) {
  return (
    <span className="flex flex-wrap gap-1.5 text-xs font-bold text-muted">
      {user.hasPin ? <span className="rounded-md bg-surface-2 px-2 py-1">PIN</span> : null}
      {user.hasPassword ? (
        <span className="rounded-md bg-surface-2 px-2 py-1">Contraseña</span>
      ) : null}
    </span>
  );
}

export function UsersPage() {
  const { data: me } = useSession();
  const users = useUsers();
  const update = useUpdateUser();
  const unlock = useUnlockUser();
  const remove = useDeleteUser();
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<UserDto | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users.data ?? []).filter(
      (u) =>
        (filter === 'all' || (filter === 'active' ? u.active : !u.active)) &&
        (!q || u.name.toLowerCase().includes(q) || u.username.includes(q)),
    );
  }, [users.data, filter, search]);

  const openForm = (user?: UserDto) => {
    setEditing(user);
    setFormOpen(true);
  };

  const runConfirm = () => {
    if (!confirm) return;
    const { kind, user } = confirm;
    const done = {
      onSettled: () => setConfirm(null),
      onError: (e: unknown) => toast.error(errorMessage(e)),
    };
    if (kind === 'toggle') {
      update.mutate(
        { id: user.id, input: { active: !user.active } },
        {
          ...done,
          onSuccess: () =>
            toast.success(
              user.active ? `${user.name} quedó inactivo.` : `${user.name} está activo de nuevo.`,
            ),
        },
      );
    } else {
      remove.mutate(user.id, {
        ...done,
        onSuccess: () => toast.success(`${user.name} fue eliminado.`),
      });
    }
  };

  const doUnlock = (user: UserDto) =>
    unlock.mutate(user.id, {
      onSuccess: () => toast.success(`${user.name} fue desbloqueado.`),
      onError: (e) => toast.error(errorMessage(e)),
    });

  const actions = (u: UserDto) => {
    const isMe = u.id === me?.id;
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        {u.lockedUntil ? (
          <Button
            variant="secondary"
            onClick={() => doUnlock(u)}
            loading={unlock.isPending && unlock.variables === u.id}
          >
            <LockOpen aria-hidden="true" className="size-4" />
            Desbloquear
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => openForm(u)} aria-label={`Editar a ${u.name}`}>
          <Pencil aria-hidden="true" className="size-4" />
          <span className="sm:hidden lg:inline">Editar</span>
        </Button>
        {!isMe ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfirm({ kind: 'toggle', user: u })}
              aria-label={u.active ? `Desactivar a ${u.name}` : `Activar a ${u.name}`}
              title={u.active ? 'Desactivar' : 'Activar'}
            >
              <Power aria-hidden="true" className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-danger-ink"
              onClick={() => setConfirm({ kind: 'delete', user: u })}
              aria-label={`Eliminar a ${u.name}`}
              title="Eliminar"
            >
              <Trash2 aria-hidden="true" className="size-5" />
            </Button>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Vendedores (entran con PIN) y administradores (entran con contraseña)."
        actions={
          <Button size="lg" onClick={() => openForm()}>
            <Plus aria-hidden="true" className="size-5" />
            Nuevo usuario
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          label="Mostrar"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: 'Activos' },
            { value: 'inactive', label: 'Inactivos' },
            { value: 'all', label: 'Todos' },
          ]}
        />
        <div className="relative min-w-56 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            aria-label="Buscar usuario"
            placeholder="Buscar por nombre o usuario…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11"
          />
        </div>
      </div>

      {users.isPending ? (
        <div className="grid place-items-center py-16 text-primary">
          <Spinner label="Cargando usuarios…" />
        </div>
      ) : users.error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p role="alert" className="font-semibold text-danger-ink">
            {errorMessage(users.error)}
          </p>
          <Button onClick={() => void users.refetch()}>Reintentar</Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
          <KeyRound aria-hidden="true" className="size-8 text-muted" />
          <p className="font-bold">No hay usuarios con ese filtro.</p>
        </div>
      ) : (
        <>
          {/* Tabla en pantallas medianas y grandes */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface sm:block">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2/50 text-left text-muted">
                  <th className="px-4 py-3.5 font-bold">Nombre</th>
                  <th className="px-4 py-3.5 font-bold">Rol</th>
                  <th className="px-4 py-3.5 font-bold">Acceso</th>
                  <th className="px-4 py-3.5 font-bold">Estado</th>
                  <th className="px-4 py-3.5 font-bold">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id} className="border-t border-surface-2">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={initialsOf(u.name)} className="size-9 text-sm" />
                        <div>
                          <p className="font-bold">
                            {u.name}{' '}
                            {u.id === me?.id ? (
                              <span className="font-semibold text-muted">(tú)</span>
                            ) : null}
                          </p>
                          <p className="text-muted">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.role === 'ADMIN' ? 'secondary' : 'neutral'}>
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <AccessChips user={u} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge user={u} />
                      {u.lockedUntil ? (
                        <p className="mt-1 text-xs text-muted">
                          Hasta {formatDateTime(u.lockedUntil)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">{actions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas en celular */}
          <ul className="flex flex-col gap-2.5 sm:hidden">
            {visible.map((u) => (
              <li
                key={u.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar initials={initialsOf(u.name)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">
                      {u.name}{' '}
                      {u.id === me?.id ? (
                        <span className="font-semibold text-muted">(tú)</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted">
                      @{u.username} · {ROLE_LABELS[u.role]}
                    </p>
                  </div>
                  <StatusBadge user={u} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <AccessChips user={u} />
                  {actions(u)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <UserFormModal open={formOpen} user={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        loading={update.isPending || remove.isPending}
        onConfirm={runConfirm}
        tone={confirm?.kind === 'delete' || confirm?.user.active ? 'danger' : 'primary'}
        title={
          confirm?.kind === 'delete'
            ? 'Eliminar usuario'
            : confirm?.user.active
              ? 'Desactivar usuario'
              : 'Activar usuario'
        }
        confirmLabel={
          confirm?.kind === 'delete' ? 'Eliminar' : confirm?.user.active ? 'Desactivar' : 'Activar'
        }
        message={
          confirm?.kind === 'delete'
            ? `¿Eliminar a ${confirm.user.name}? Si ya tiene ventas o movimientos registrados no se podrá eliminar; en ese caso desactívalo.`
            : confirm?.user.active
              ? `${confirm.user.name} no podrá entrar y se cerrarán sus sesiones abiertas. Su historial se conserva.`
              : `${confirm?.user.name ?? ''} podrá volver a entrar con su PIN o contraseña.`
        }
      />
    </div>
  );
}
