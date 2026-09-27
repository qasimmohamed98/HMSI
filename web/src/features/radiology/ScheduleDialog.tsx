import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { DepartmentUnit } from '@hmsi/shared';
import { Button, Dialog, Select, useToast } from '@/components/ui';
import { API, type RadiologyWorkItem } from '@/lib/api';
import { localizeServerMessage } from '@/i18n/server-messages';
import { currentLang } from '@/i18n';
import { localName } from '@/lib/format';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * حجز موعد فحص على جهاز أو غرفة (أو إعادة جدولته أو إلغاؤه). يُستخدم من قائمة العمل وجدول المواعيد اليومي.
 */
export function ScheduleDialog({ item, defaultDate, onClose, onDone }: { item: RadiologyWorkItem; defaultDate?: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const en = currentLang() === 'en';
  const { data: units } = useQuery({ queryKey: ['units', 'all'], queryFn: () => API.listUnits(), staleTime: 60_000 });
  const [unitId, setUnitId] = useState(item.unit_id ?? '');
  const [when, setWhen] = useState(toLocalInput(item.scheduled_at) || (defaultDate ? `${defaultDate}T09:00` : ''));

  const list: DepartmentUnit[] = (units ?? []).filter((u) => !item.modality || !u.modality || u.modality === item.modality);
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['radiology', 'worklist'] });
    void qc.invalidateQueries({ queryKey: ['radiology', 'schedule'] });
  };
  const scheduleMut = useMutation({
    mutationFn: () => API.scheduleRadiology(item.id, { unitId, scheduledAt: new Date(when).toISOString() }),
    onSuccess: () => {
      invalidate();
      toast.success(t('imaging.scheduled'));
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic')),
  });
  const cancelMut = useMutation({
    mutationFn: () => API.unscheduleRadiology(item.id),
    onSuccess: () => {
      invalidate();
      toast.success(t('imaging.bookingCancelled'));
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic')),
  });

  const valid = Boolean(unitId) && Boolean(when);
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('imaging.scheduleTitle', { name: en && item.study_type_en ? item.study_type_en : item.study_type_ar })}
      footer={
        <>
          {item.stage === 'scheduled' && (
            <Button variant="ghost" className="text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/30" loading={cancelMut.isPending} onClick={() => cancelMut.mutate()}>
              {t('imaging.cancelBooking')}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => scheduleMut.mutate()} loading={scheduleMut.isPending} disabled={!valid}>
            {t('imaging.bookSlot')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm font-semibold text-ink/70">
          {localName(item, 'full_name')} · {item.file_number}
        </p>
        <Select
          label={t('imaging.device')}
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          placeholder={t('imaging.anyDevice')}
          options={list.map((u) => ({ value: u.id, label: `${localName(u, 'name')}${u.status !== 'active' ? ` — ${t(`org.unitStatus.${u.status}`)}` : ''}` }))}
        />
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink/90" htmlFor="sched-when">
            {t('imaging.dateTime')}
          </label>
          <input
            id="sched-when"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="h-11 w-full rounded-lg border border-ink/15 bg-surface-raised px-3.5 text-[0.95rem] text-ink focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>
    </Dialog>
  );
}
