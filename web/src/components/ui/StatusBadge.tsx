import { useTranslation } from 'react-i18next';
import { Badge } from './Badge';

const MAP = {
  active: { variant: 'success', key: 'status.active' },
  discharged: { variant: 'neutral', key: 'status.discharged' },
  transferred: { variant: 'info', key: 'status.transferred' },
  occupied: { variant: 'success', key: 'status.occupied' },
  free: { variant: 'neutral', key: 'status.free' },
} as const;

export function StatusBadge({ status }: { status: keyof typeof MAP }) {
  const { t } = useTranslation();
  const m = MAP[status];
  if (!m) return null;
  return <Badge variant={m.variant} dot>{t(m.key)}</Badge>;
}