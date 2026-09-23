import { useTranslation } from 'react-i18next';
import { Button, Dialog } from '@/components/ui';
import { AlertTriangle } from 'lucide-react';

export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {confirmLabel ?? t('common.delete')}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger-50 text-danger-600 dark:bg-danger-900/40 dark:text-danger-300">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <p className="pt-1 text-sm text-ink/75">{message}</p>
      </div>
    </Dialog>
  );
}