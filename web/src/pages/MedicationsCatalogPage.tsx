import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download, Pencil, Plus, Search, ShieldAlert } from 'lucide-react';
import { MEDICATION_FORMS, type MedicationCatalogItem, type MedicationForm } from '@hmsi/shared';
import { Badge, Button, Card, CardContent, Dialog, EmptyState, Input, Select, Skeleton, useToast } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { localizeServerMessage } from '@/i18n/server-messages';
import { API, type MedicationCatalogInput } from '@/lib/api';
import { localName } from '@/lib/format';

/** قائمة الأدوية المعتمدة (Formulary) للمستشفى — يديرها الصيدلي، ويستخدمها كل من يصف دواءً */
export default function MedicationsCatalogPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<MedicationCatalogItem | 'new' | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['medications-catalog', 'all'], queryFn: () => API.listMedicationsCatalog({ all: true }) });

  const onError = (e: unknown) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic'));
  const refresh = () => void qc.invalidateQueries({ queryKey: ['medications-catalog'] });
  const importMut = useMutation({
    mutationFn: API.importDefaultMedications,
    onSuccess: (r) => {
      refresh();
      toast.success(t('formulary.imported', r));
    },
    onError,
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter(
      (m) => m.generic_name_ar.includes(term) || (m.generic_name_en ?? '').toLowerCase().includes(term) || (m.brand_name_ar ?? '').includes(term) || (m.brand_name_en ?? '').toLowerCase().includes(term),
    );
  }, [data, q]);

  return (
    <div>
      <PageHeader
        title={t('formulary.title')}
        subtitle={t('formulary.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<Download className="h-4 w-4" />} loading={importMut.isPending} onClick={() => importMut.mutate()} title={t('formulary.importHint')}>
              {t('formulary.importDefaults')}
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              {t('formulary.add')}
            </Button>
          </div>
        }
      />

      <div className="mb-4 max-w-md">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('formulary.search')} icon={<Search className="h-4 w-4" />} aria-label={t('formulary.search')} />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data?.length ? (
        <Card>
          <CardContent>
            <EmptyState title={t('formulary.empty')} description={t('formulary.emptyHint')} action={{ label: t('formulary.importDefaults'), onClick: () => importMut.mutate() }} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <p className="border-b border-ink/8 px-4 py-2 text-xs text-ink/50 dark:border-white/10">{t('formulary.count', { count: rows.length })}</p>
            <ul className="divide-y divide-ink/8 dark:divide-white/10">
              {rows.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">
                      {localName(m, 'generic_name')}
                      {m.strength ? <span className="font-normal text-ink/50"> · {m.strength}</span> : null}
                    </span>
                    <span className="block text-xs text-ink/50">
                      {m.brand_name_ar ? `${localName(m, 'brand_name')} · ` : ''}
                      {t(`formulary.forms.${m.form}`)}
                      {m.route ? ` · ${m.route}` : ''}
                    </span>
                  </span>
                  {m.controlled && (
                    <Badge variant="danger">
                      <ShieldAlert className="h-3 w-3" /> {t('formulary.controlled')}
                    </Badge>
                  )}
                  {!m.is_active && <Badge variant="neutral">{t('services.inactive')}</Badge>}
                  <Button size="icon-sm" variant="ghost" aria-label={t('common.edit')} onClick={() => setEditing(m)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {editing && <MedicationCatalogDialog item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}

function MedicationCatalogDialog({ item, onClose, onSaved }: { item: MedicationCatalogItem | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [f, setF] = useState<MedicationCatalogInput>(
    item
      ? { genericNameAr: item.generic_name_ar, genericNameEn: item.generic_name_en, brandNameAr: item.brand_name_ar, brandNameEn: item.brand_name_en, form: item.form, strength: item.strength, route: item.route, controlled: item.controlled, isActive: item.is_active }
      : { genericNameAr: '', genericNameEn: '', brandNameAr: '', brandNameEn: '', form: 'tablet', strength: '', route: '', controlled: false, isActive: true },
  );
  const set = <K extends keyof MedicationCatalogInput>(k: K, v: MedicationCatalogInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body: MedicationCatalogInput = { ...f, genericNameEn: f.genericNameEn || null, brandNameAr: f.brandNameAr || null, brandNameEn: f.brandNameEn || null, strength: f.strength || null, route: f.route || null };
      return item ? API.updateMedicationCatalogItem(item.id, body) : API.createMedicationCatalogItem(body);
    },
    onSuccess: () => {
      onSaved();
      onClose();
      toast.success(t('common.done'));
    },
    onError: (e) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic')),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={item ? t('formulary.edit') : t('formulary.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={f.genericNameAr.trim().length < 2}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('formulary.genericAr')} value={f.genericNameAr} onChange={(e) => set('genericNameAr', e.target.value)} required autoFocus />
        <Input label={t('formulary.genericEn')} value={f.genericNameEn ?? ''} onChange={(e) => set('genericNameEn', e.target.value)} dir="ltr" />
        <Input label={t('formulary.brandAr')} value={f.brandNameAr ?? ''} onChange={(e) => set('brandNameAr', e.target.value)} />
        <Input label={t('formulary.brandEn')} value={f.brandNameEn ?? ''} onChange={(e) => set('brandNameEn', e.target.value)} dir="ltr" />
        <Select label={t('formulary.form')} value={f.form} onChange={(e) => set('form', e.target.value as MedicationForm)} options={MEDICATION_FORMS.map((x) => ({ value: x, label: t(`formulary.forms.${x}`) }))} />
        <Input label={t('formulary.strength')} value={f.strength ?? ''} onChange={(e) => set('strength', e.target.value)} placeholder="500 mg" dir="ltr" />
        <Input label={t('formulary.route')} value={f.route ?? ''} onChange={(e) => set('route', e.target.value)} placeholder="PO / IV / IM…" dir="ltr" />
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-semibold text-ink">
          <input type="checkbox" checked={Boolean(f.controlled)} onChange={(e) => set('controlled', e.target.checked)} className="h-4 w-4 accent-danger-600" />
          {t('formulary.controlled')}
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink sm:col-span-2">
          <input type="checkbox" checked={f.isActive !== false} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4 accent-brand-600" />
          {t('services.activeToggle')}
        </label>
      </div>
    </Dialog>
  );
}
