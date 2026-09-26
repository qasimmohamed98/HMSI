import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download, Pencil, Plus, Search } from 'lucide-react';
import { MODALITIES, SERVICE_KINDS, type ServiceItem, type ServiceKind } from '@hmsi/shared';
import { Badge, Button, Card, CardContent, Dialog, EmptyState, Input, Select, Skeleton, Textarea, useToast } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { localizeServerMessage } from '@/i18n/server-messages';
import { API, type ServiceInput } from '@/lib/api';
import { localName } from '@/lib/format';

/** كتالوج الخدمات والأسعار للمستشفى (الإدارة والمحاسب) */
export default function ServicesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [kind, setKind] = useState<ServiceKind | ''>('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<ServiceItem | 'new' | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['services', 'all'], queryFn: () => API.listServices({ all: true }) });

  const onError = (e: unknown) => toast.error(e instanceof Error ? localizeServerMessage(e.message) : t('errors.generic'));
  const refresh = () => void qc.invalidateQueries({ queryKey: ['services'] });
  const importMut = useMutation({
    mutationFn: API.importDefaultServices,
    onSuccess: (r) => {
      refresh();
      toast.success(t('services.imported', r));
    },
    onError,
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter(
      (s) => (!kind || s.kind === kind) && (!term || s.name_ar.includes(term) || (s.name_en ?? '').toLowerCase().includes(term) || s.code.toLowerCase().includes(term)),
    );
  }, [data, kind, q]);

  return (
    <div>
      <PageHeader
        title={t('services.title')}
        subtitle={t('services.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<Download className="h-4 w-4" />} loading={importMut.isPending} onClick={() => importMut.mutate()} title={t('services.importHint')}>
              {t('services.importDefaults')}
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              {t('services.add')}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('services.search')} icon={<Search className="h-4 w-4" />} aria-label={t('services.search')} />
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('services.kindLabel')}>
          {(['', ...SERVICE_KINDS] as const).map((k) => (
            <button
              key={k || 'all'}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${kind === k ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200' : 'border-ink/12 text-ink/60 hover:bg-surface-muted dark:border-white/15'}`}
            >
              {k ? t(`services.kinds.${k}`) : t('services.allKinds')}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data?.length ? (
        <Card>
          <CardContent>
            <EmptyState title={t('services.empty')} description={t('services.emptyHint')} action={{ label: t('services.importDefaults'), onClick: () => importMut.mutate() }} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <p className="border-b border-ink/8 px-4 py-2 text-xs text-ink/50 dark:border-white/10">{t('services.count', { count: rows.length })}</p>
            <ul className="divide-y divide-ink/8 dark:divide-white/10">
              {rows.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-28 shrink-0 font-mono text-xs text-ink/55" dir="ltr">
                    {s.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{localName(s, 'name')}</span>
                    <span className="block text-xs text-ink/50">
                      {t(`services.kinds.${s.kind}`)}
                      {s.modality ? ` · ${t(`org.modality.${s.modality}`)}` : ''}
                      {s.prep_ar ? ` · ${t('services.prepAr')}` : ''}
                    </span>
                  </span>
                  {!s.is_active && <Badge variant="neutral">{t('services.inactive')}</Badge>}
                  <span className="w-32 text-end font-bold tabular-nums text-ink">{s.price == null ? <span className="text-sm font-normal text-ink/40">{t('services.noPrice')}</span> : s.price.toLocaleString('en')}</span>
                  <Button size="icon-sm" variant="ghost" aria-label={t('common.edit')} onClick={() => setEditing(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {editing && <ServiceDialog item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}

function ServiceDialog({ item, onClose, onSaved }: { item: ServiceItem | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [f, setF] = useState<ServiceInput>(
    item
      ? { kind: item.kind, code: item.code, name_ar: item.name_ar, name_en: item.name_en, modality: item.modality, price: item.price, prep_ar: item.prep_ar, prep_en: item.prep_en, is_active: item.is_active }
      : { kind: 'imaging', code: '', name_ar: '', name_en: '', modality: 'XR', price: null, prep_ar: '', prep_en: '', is_active: true },
  );
  const set = <K extends keyof ServiceInput>(k: K, v: ServiceInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body: ServiceInput = { ...f, name_en: f.name_en || null, prep_ar: f.prep_ar || null, prep_en: f.prep_en || null, modality: f.kind === 'imaging' ? f.modality || null : null };
      return item ? API.updateService(item.id, body) : API.createService(body);
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
      title={item ? t('services.edit') : t('services.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!f.code.trim() || f.name_ar.trim().length < 2}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t('services.kindLabel')} value={f.kind} onChange={(e) => set('kind', e.target.value as ServiceKind)} options={SERVICE_KINDS.map((k) => ({ value: k, label: t(`services.kinds.${k}`) }))} />
        {f.kind === 'imaging' ? (
          <Select label={t('services.modality')} value={f.modality ?? ''} onChange={(e) => set('modality', (e.target.value || null) as ServiceInput['modality'])} options={MODALITIES.map((m) => ({ value: m, label: t(`org.modality.${m}`) }))} />
        ) : (
          <span />
        )}
        <Input label={t('services.code')} hint={t('services.codeHint')} value={f.code} onChange={(e) => set('code', e.target.value)} dir="ltr" required />
        <Input
          label={t('services.price')}
          hint={t('services.priceHint')}
          inputMode="numeric"
          dir="ltr"
          value={f.price == null ? '' : String(f.price)}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d]/g, '');
            set('price', v ? Number(v) : null);
          }}
        />
        <Input label={t('services.nameAr')} value={f.name_ar} onChange={(e) => set('name_ar', e.target.value)} required />
        <Input label={t('services.nameEn')} value={f.name_en ?? ''} onChange={(e) => set('name_en', e.target.value)} dir="ltr" />
        <div className="sm:col-span-2">
          <Textarea label={t('services.prepAr')} value={f.prep_ar ?? ''} onChange={(e) => set('prep_ar', e.target.value)} rows={2} />
        </div>
        <div className="sm:col-span-2">
          <Textarea label={t('services.prepEn')} value={f.prep_en ?? ''} onChange={(e) => set('prep_en', e.target.value)} rows={2} dir="ltr" />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink sm:col-span-2">
          <input type="checkbox" checked={f.is_active !== false} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 accent-brand-600" />
          {t('services.activeToggle')}
        </label>
      </div>
    </Dialog>
  );
}
