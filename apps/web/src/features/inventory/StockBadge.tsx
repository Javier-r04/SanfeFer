import { STOCK_STATUS_LABELS, type StockStatus } from '@sanfefer/shared';
import { Badge } from '@/components/ui/Badge';

const tones = { OK: 'primary', LOW: 'warning', OUT: 'danger' } as const;

export function StockBadge({ status }: { status: StockStatus }) {
  return <Badge tone={tones[status]}>{STOCK_STATUS_LABELS[status]}</Badge>;
}
