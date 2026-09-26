import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, MonitorCog, DoorOpen } from 'lucide-react';
import { MODALITIES, type Department, type DepartmentUnit } from '@hmsi/shared';
import { Badge, Button, Dialog, EmptyState, Input, Select, Skeleton, useToast } from '@/components/ui';
import { localizeServerMessage } from '@/i18n/server-messages';
import { API, type UnitInput } from '@/lib/api';
import { localName } from '@/lib/format';

const STATUS_VARIANT: Record<DepartmentUnit['status'], 'success' | 'warning' | 'danger'> = { active: 'success', maintenance: 'warning', out_of_service: 'danger' };

/** أجهزة القسم وغرفه: إضافة، تغيير الحالة (يعمل/صيانة/متوقف)، حذف */
export function UnitsDialog({ dept, onClose }: { dept: Department; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const key = ['units', dept.id];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => API.listUnits(dept.id) });
  const [form, setForm] = useState<UnitInput>({ kind: 'device', modality: dept.kind === 'radiology' ? 'CT' : null, name_ar: '', name_en: '' });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ['departments'] });
  };
  const onError = (e: unknown) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic'));
  const add = useMutation({
    mutationFn: () => API.createUnit(dept.id, { ...form, name_en: form.name_en || null }),
    onSuccess: () => {
      refresh();
      setForm((f) => ({ ...f, name_ar: '', name_en: '' }));
    },
    onError,
  });
  const setStatus = useMutation({ mutationFn: (a: { id: string; status: DepartmentUnit['status'] }) => API.updateUnit(a.id, { status: a.status }), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: (id: string) => API.deleteUnit(id), onSuccess: refresh, onError });

  return (
    <Dialog open onClose={onClose} title={t('org.unitsTitle', { name: localName(dept, 'name') })} size="lg">
      <p className="mb-4 text-sm text-ink/60">{t('org.unitsHint')}</p>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !data?.length ? (
        <EmptyState title={t('org.noUnits')} />
      ) : (
        <ul className="mb-5 divide-y divide-ink/8 rounded-xl border border-ink/10 dark:divide-white/10 dark:border-white/10">
          {data.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              {u.kind === 'room' ? <DoorOpen className="h-4 w-4 text-ink/50" /> : <MonitorCog className="h-4 w-4 text-ink/50" />}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{localName(u, 'name')}</span>
                <span className="block text-xs text-ink/50">
                  {t(`org.unitKind.${u.kind}`)}
                  {u.modality ? ` · ${t(`org.modality.${u.modality}`)}` : ''}
                </span>
              </span>
              <Badge variant={STATUS_VARIANT[u.status]}>{t(`org.unitStatus.${u.status}`)}</Badge>
              <select
                aria-label={t('org.unitStatus.active')}
                value={u.status}
                onChange={(e) => setStatus.mutate({ id: u.id, status: e.target.value as DepartmentUnit['status'] })}
                className="rounded-lg border border-ink/15 bg-surface px-2 py-1 text-sm dark:border-white/15"
              >
                {(['active', 'maintenance', 'out_of_service'] as const).map((s) => (
                  <option key={s} value={s}>
                    {t(`org.unitStatus.${s}`)}
                  </option>
                ))}
              </select>
              <Button size="icon-sm" variant="ghost" aria-label={t('common.delete')} className="text-danger-500" onClick={() => remove.mutate(u.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="grid gap-3 rounded-xl bg-surface-muted p-3 sm:grid-cols-2 dark:bg-white/5"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.name_ar.trim()) add.mutate();
        }}
      >
        <Select
          label={t('org.unitKind.device') + ' / ' + t('org.unitKind.room')}
          value={form.kind}
          onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as UnitInput['kind'] }))}
          options={(['device', 'room'] as const).map((k) => ({ value: k, label: t(`org.unitKind.${k}`) }))}
        />
        <Select
          label={t('org.modalityLabel')}
          value={form.modality ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, modality: (e.target.value || null) as UnitInput['modality'] }))}
          options={[{ value: '', label: t('org.noModality') }, ...MODALITIES.map((m) => ({ value: m, label: t(`org.modality.${m}`) }))]}
        />
        <Input label={t('org.unitName')} value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} placeholder={t('examples.unit')} required />
        <Input label={t('org.unitNameEn')} value={form.name_en ?? ''} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} dir="ltr" placeholder="CT 1" />
        <div className="sm:col-span-2">
          <Button type="submit" icon={<Plus className="h-4 w-4" />} loading={add.isPending}>
            {t('org.addUnit')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
