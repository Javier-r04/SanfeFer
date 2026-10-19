import { zodResolver } from '@hookform/resolvers/zod';
import { settingsSchema, type SettingsInput, type TicketDocument } from '@sanfefer/shared';
import { Printer } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Switch } from '@/components/ui/Switch';
import { PageHeader } from '@/features/common/ComingSoon';
import { handleFormError } from '@/lib/forms';
import { printInBrowser } from '@/printing/print';
import { TicketPreview } from '@/printing/TicketPreview';
import { toast } from '@/stores/toast';
import { useSettings, useUpdateSettings } from './api';

const sampleTicket = (v: SettingsInput): TicketDocument => ({
  kind: 'PRECUENTA',
  businessName: v.businessName || 'SanfeFer',
  headerLines: [
    v.address,
    v.phone ? `Tel. ${v.phone}` : null,
    v.taxId ? `NIT ${v.taxId}` : null,
  ].filter((x): x is string => !!x),
  meta: [
    ['Folio', '#000001'],
    ['Mesa', 'Mesa 4 · Andrea'],
  ],
  items: [
    { quantity: 1, name: 'Michelada clásica', details: ['+ Corona, Tajín'], amount: 43 },
    { quantity: 2, name: 'Gallo', details: [], amount: 40 },
  ],
  totals: [
    { label: 'Subtotal', amount: 83 },
    { label: 'TOTAL', amount: 83, strong: true },
  ],
  payments: [],
  footer: v.ticketFooter ? [v.ticketFooter] : [],
});

export function SettingsPage() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isDirty },
  } = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    if (settings.data) {
      const s = settings.data;
      reset({
        ...s,
        address: s.address ?? '',
        phone: s.phone ?? '',
        taxId: s.taxId ?? '',
        ticketFooter: s.ticketFooter ?? '',
      });
    }
  }, [settings.data, reset]);

  if (settings.isPending) return <LoadingState />;
  if (settings.error)
    return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;

  const values = watch();
  const paperWidth = (values.paperWidth ?? 80) as 58 | 80;
  const onSubmit = handleSubmit((v) =>
    update.mutate(v, {
      onSuccess: () => toast.success('Ajustes guardados.'),
      onError: (e) => handleFormError(e, setError),
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Ajustes"
        subtitle="Datos del negocio, cobro e impresión de tickets."
        actions={
          <Button type="submit" size="lg" loading={update.isPending} disabled={!isDirty}>
            Guardar cambios
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-6">
          <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2">
            <h2 className="text-lg font-extrabold sm:col-span-2">Negocio (aparece en el ticket)</h2>
            <Field label="Nombre del negocio" error={errors.businessName?.message}>
              {(a) => <Input {...a} {...register('businessName')} />}
            </Field>
            <Field label="Teléfono" error={errors.phone?.message}>
              {(a) => <Input {...a} {...register('phone')} type="tel" />}
            </Field>
            <Field label="Dirección" error={errors.address?.message} className="sm:col-span-2">
              {(a) => <Input {...a} {...register('address')} />}
            </Field>
            <Field
              label="NIT (informativo)"
              error={errors.taxId?.message}
              hint="El ticket es un comprobante interno, no factura."
            >
              {(a) => <Input {...a} {...register('taxId')} />}
            </Field>
            <Field label="Pie del ticket" error={errors.ticketFooter?.message}>
              {(a) => (
                <Input {...a} {...register('ticketFooter')} placeholder="¡Gracias por su visita!" />
              )}
            </Field>
          </section>

          <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2">
            <h2 className="text-lg font-extrabold sm:col-span-2">Cobro</h2>
            <Field
              label="Cargo por servicio (%)"
              error={errors.serviceChargeRate?.message}
              hint="Se puede activar o quitar en cada cuenta."
            >
              {(a) => (
                <Input
                  {...a}
                  {...register('serviceChargeRate', { valueAsNumber: true })}
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min={0}
                  max={30}
                />
              )}
            </Field>
            <div className="flex items-end pb-1">
              <Controller
                control={control}
                name="serviceChargeByDefault"
                render={({ field }) => (
                  <Switch
                    checked={!!field.value}
                    onChange={field.onChange}
                    label="Aplicarlo por defecto a las cuentas nuevas"
                    showLabel
                  />
                )}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-lg font-extrabold">Inventario</h2>
            <Controller
              control={control}
              name="allowNegativeStock"
              render={({ field }) => (
                <Switch
                  checked={!!field.value}
                  onChange={field.onChange}
                  label="Permitir vender aunque el inventario diga que no hay"
                  showLabel
                />
              )}
            />
            <p className="text-sm text-muted">
              Recomendado mientras los conteos no sean exactos: la venta se registra y el sistema
              avisa que el artículo quedó en negativo.
            </p>
          </section>
        </div>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 lg:w-[400px]">
          <h2 className="text-lg font-extrabold">Impresión</h2>
          <Controller
            control={control}
            name="paperWidth"
            render={({ field }) => (
              <Segmented
                label="Ancho del papel"
                value={String(field.value ?? 80) as '58' | '80'}
                onChange={(v) => field.onChange(Number(v))}
                options={[
                  { value: '58', label: 'Papel de 58 mm' },
                  { value: '80', label: 'Papel de 80 mm' },
                ]}
              />
            )}
          />
          <div className="overflow-x-auto rounded-2xl bg-surface-2 py-4">
            <TicketPreview document={sampleTicket(values)} paperWidth={paperWidth} />
          </div>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => printInBrowser(sampleTicket(values), paperWidth)}
          >
            <Printer aria-hidden="true" className="size-5" />
            Imprimir ticket de prueba
          </Button>
          <p className="text-sm text-muted">
            Impresoras térmicas ESC/POS: desde Chrome o Edge en PC se pueden conectar por USB/serie
            con el botón «Impresora térmica» del ticket.
          </p>
        </section>
      </div>
    </form>
  );
}
