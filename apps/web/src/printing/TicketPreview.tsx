import { columnsFor, layoutTicket, type TicketDocument } from '@sanfefer/shared';
import { cn } from '@/lib/cn';

/** Vista previa fiel del ticket: usa exactamente las mismas líneas que se envían a la impresora. */
export function TicketPreview({
  document,
  paperWidth,
}: {
  document: TicketDocument;
  paperWidth: 58 | 80;
}) {
  const lines = layoutTicket(document, columnsFor(paperWidth));
  return (
    <div
      role="document"
      aria-label="Vista previa del ticket"
      className={cn(
        'mx-auto bg-white px-4 py-5 font-mono text-[11px] leading-[1.45] text-black shadow-md',
        paperWidth === 58 ? 'w-[260px]' : 'w-[360px]',
      )}
    >
      {lines.map((l, i) =>
        l.kind === 'rule' ? (
          <div key={i} className="my-1 border-t border-dashed border-black" />
        ) : l.kind === 'feed' ? (
          <div key={i} className="h-2" />
        ) : (
          <div
            key={i}
            className={cn(
              'whitespace-pre',
              l.align === 'center' && 'text-center',
              l.bold && 'font-bold',
              l.size === 'large' && 'text-[15px]',
            )}
          >
            {l.text || ' '}
          </div>
        ),
      )}
    </div>
  );
}
