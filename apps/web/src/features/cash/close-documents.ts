import type { CashSessionDto, DailyCloseDto, SettingsDto, TicketDocument } from '@sanfefer/shared';

const dt = new Intl.DateTimeFormat('es-GT', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Guatemala',
});
const header = (s?: SettingsDto) => ({
  businessName: s?.businessName ?? 'SanfeFer',
  headerLines: [s?.address, s?.phone ? `Tel. ${s.phone}` : null].filter((x): x is string => !!x),
});

/** Comprobante de cierre de caja para imprimir (navegador o térmica). */
export function cashCloseDocument(session: CashSessionDto, settings?: SettingsDto): TicketDocument {
  return {
    kind: 'CIERRE',
    title: `CIERRE DE CAJA #${session.id}`,
    ...header(settings),
    meta: [
      ['Abrió', `${session.openedBy.name.split(' ')[0]} ${dt.format(new Date(session.openedAt))}`],
      [
        'Cerró',
        session.closedAt
          ? `${session.closedBy?.name.split(' ')[0] ?? ''} ${dt.format(new Date(session.closedAt))}`
          : 'Abierta',
      ],
      ['Cobros', String(session.paymentsCount)],
    ],
    items: [],
    totals: [
      { label: 'Fondo inicial', amount: session.openingAmount },
      { label: 'Ventas en efectivo', amount: session.cashSales },
      { label: 'Entradas', amount: session.movementsIn },
      { label: 'Salidas', amount: -session.movementsOut },
      { label: 'Debe haber', amount: session.expectedCash, strong: true },
      ...(session.countedCash !== null ? [{ label: 'Contado', amount: session.countedCash }] : []),
      ...(session.difference !== null ? [{ label: 'Diferencia', amount: session.difference }] : []),
    ],
    payments: [{ label: 'Ventas con tarjeta', amount: session.cardSales }],
    footer: session.notes ? [session.notes] : [],
  };
}

/** Resumen del cierre del día. */
export function dailyCloseDocument(d: DailyCloseDto, settings?: SettingsDto): TicketDocument {
  return {
    kind: 'CIERRE',
    title: `CIERRE DEL DÍA ${d.date.split('-').reverse().join('/')}`,
    ...header(settings),
    meta: [
      ['Cuentas cobradas', String(d.tabsPaid)],
      ['Productos vendidos', String(d.unitsSold)],
      ['Ticket promedio', d.averageTicket.toFixed(2)],
    ],
    items: d.bySeller.map((s) => ({
      quantity: s.tabs,
      name: s.name,
      details: [],
      amount: s.total,
    })),
    totals: [
      { label: 'Subtotal', amount: d.subtotal },
      { label: 'Descuentos', amount: -d.discounts },
      { label: 'Servicio', amount: d.serviceCharges },
      { label: 'TOTAL', amount: d.total, strong: true },
    ],
    payments: [
      { label: 'Efectivo', amount: d.cash },
      { label: 'Tarjeta', amount: d.card },
      { label: `Cancelado (${d.cancelled.units} u)`, amount: d.cancelled.amount },
    ],
    footer: [],
  };
}
