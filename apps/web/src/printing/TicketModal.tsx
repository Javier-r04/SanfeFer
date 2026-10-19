import { Download, Printer, Usb } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useTicket } from '@/features/pos/api';
import { errorMessage } from '@/lib/api';
import { toast } from '@/stores/toast';
import { canPrintSerial, downloadEscPos, printInBrowser, printSerial } from './print';
import { TicketPreview } from './TicketPreview';

export function TicketModal({ tabId, onClose }: { tabId: number | null; onClose: () => void }) {
  const ticket = useTicket(tabId);
  // El ancho configurado manda hasta que el usuario elige otro (un refetch no debe reiniciarlo).
  const [chosenWidth, setWidth] = useState<58 | 80 | null>(null);
  const width = chosenWidth ?? ticket.data?.paperWidth ?? 80;
  const [sending, setSending] = useState(false);

  if (tabId === null) return null;
  const doc = ticket.data?.document;

  const thermal = async () => {
    if (!doc) return;
    setSending(true);
    try {
      await printSerial(doc, width);
      toast.success('Ticket enviado a la impresora.');
    } catch (e) {
      if ((e as Error).name !== 'NotFoundError') toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={doc?.kind === 'COMPROBANTE' ? 'Comprobante' : 'Pre-cuenta'}
      description="Comprobante interno, no es factura."
      footer={
        doc ? (
          <div className="flex w-full flex-wrap gap-2">
            <Button size="lg" className="flex-1" onClick={() => printInBrowser(doc, width)}>
              <Printer aria-hidden="true" className="size-5" />
              Imprimir
            </Button>
            {canPrintSerial() ? (
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                loading={sending}
                onClick={() => void thermal()}
              >
                <Usb aria-hidden="true" className="size-5" />
                Impresora térmica
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              title="Descargar comandos ESC/POS"
              aria-label="Descargar comandos ESC/POS"
              onClick={() => downloadEscPos(doc, width, `ticket-${tabId}`)}
            >
              <Download aria-hidden="true" className="size-5" />
            </Button>
          </div>
        ) : undefined
      }
    >
      {ticket.isPending ? (
        <LoadingState />
      ) : ticket.error ? (
        <ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          <Segmented
            label="Ancho del papel"
            value={String(width) as '58' | '80'}
            onChange={(v) => setWidth(Number(v) as 58 | 80)}
            options={[
              { value: '58', label: '58 mm' },
              { value: '80', label: '80 mm' },
            ]}
          />
          <div className="overflow-x-auto rounded-2xl bg-surface-2 py-5">
            <TicketPreview document={ticket.data.document} paperWidth={width} />
          </div>
        </div>
      )}
    </Modal>
  );
}
