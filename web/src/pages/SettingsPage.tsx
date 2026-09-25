import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Languages, Moon, Sun, ShieldCheck, Hospital, Pencil, KeyRound, ImagePlus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Dialog, Input, Skeleton } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { useTheme } from '@/lib/theme';
import { setLanguage, currentLang } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { API, type HospitalProfileInput } from '@/lib/api';
import { ROLE_PERMISSIONS } from '@hmsi/shared';
import { useToast } from '@/components/ui';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { resolved, setPref } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const canEdit = user ? ROLE_PERMISSIONS[user.role].includes('settings.manage' as never) : false;

  const { data: hospital } = useQuery({ queryKey: ['hospital'], queryFn: API.hospitalProfile });

  const updateMut = useMutation({
    mutationFn: (input: HospitalProfileInput) => API.updateHospital(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hospital'] });
      void qc.invalidateQueries({ queryKey: ['wards'] });
      setEditOpen(false);
      toast.success(t('common.done'));
    },
    onError: (e) => toast.error((e as Error).message || t('errors.generic')),
  });

  const themeOptions = [
    { value: 'light', label: t('theme.light'), icon: Sun },
    { value: 'dark', label: t('theme.dark'), icon: Moon },
    { value: 'system', label: t('theme.system'), icon: Sun },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={t('nav.settings')} subtitle={t('ui.settingsSubtitle')} />

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-brand-600" />
            {t('lang.label')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <SegmentedOption active={currentLang() === 'ar'} onClick={() => setLanguage('ar')}>
              {t('lang.ar')} · RTL
            </SegmentedOption>
            <SegmentedOption active={currentLang() === 'en'} onClick={() => setLanguage('en')}>
              {t('lang.en')} · LTR
            </SegmentedOption>
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {resolved === 'dark' ? <Moon className="h-5 w-5 text-brand-600" /> : <Sun className="h-5 w-5 text-brand-600" />}
            {t('ui.themeTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2" role="radiogroup">
            {themeOptions.map((o) => (
              <SegmentedOption key={o.value} active={resolved === o.value} onClick={() => setPref(o.value)}>
                <o.icon className="h-4 w-4" />
                {o.label}
              </SegmentedOption>
            ))}
          </div>
        </CardContent>
      </Card>

      <ChangePasswordCard />

      {/* Hospital */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hospital className="h-5 w-5 text-brand-600" />
            {t('nav.hospital')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hospital ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : (
            <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted/70 p-4 dark:bg-white/5">
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">{hospital.name_ar}</p>
                <p className="truncate text-sm text-ink/50">{hospital.name_en}</p>
                <p className="mt-0.5 text-xs tabular text-ink/35" dir="ltr">{hospital.code}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="brand">
                  <ShieldCheck className="me-1 h-3.5 w-3.5" />
                  {t('ui.active')}
                </Badge>
                {canEdit && (
                  <Button size="icon-sm" variant="ghost" aria-label={t('common.edit')} onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <LogoCard logoUrl={hospital.logo_url ?? null} canEdit={canEdit} />
            </div>
          )}
        </CardContent>
      </Card>

      {hospital && editOpen && (
        <HospitalDialog
          open
          onClose={() => setEditOpen(false)}
          initial={hospital}
          onSubmit={(input) => updateMut.mutate(input)}
          busy={updateMut.isPending}
        />
      )}
    </div>
  );
}

function HospitalDialog({
  open,
  onClose,
  initial,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  initial: { name_ar: string; name_en: string };
  onSubmit: (i: HospitalProfileInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [nameAr, setNameAr] = useState(initial.name_ar);
  const [nameEn, setNameEn] = useState(initial.name_en);
  const [error, setError] = useState('');

  const submit = () => {
    if (nameAr.trim().length < 2 || nameEn.trim().length < 2) {
      setError(t('errors.required'));
      return;
    }
    onSubmit({ nameAr, nameEn });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('settings.hospitalEdit')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={busy}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-sm font-semibold text-danger-600">{error}</p>}
        <Input label={t('settings.hospitalNameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} autoFocus placeholder="مستشفى المدينة الجامعية" />
        <Input label={t('settings.hospitalNameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="City University Hospital" dir="ltr" />
      </div>
    </Dialog>
  );
}

function SegmentedOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200'
          : 'border-ink/12 text-ink/60 hover:bg-surface-muted dark:border-white/15 dark:text-white/60',
      )}
    >
      {children}
    </button>
  );
}
function ChangePasswordCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = confirm.length > 0 && next !== confirm;
  const mut = useMutation({
    mutationFn: () => API.changePassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success(t('password.changed'));
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-brand-600" />
          {t('password.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!mismatch && current && next) mut.mutate();
          }}
        >
          <Input label={t('password.current')} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} dir="ltr" />
          <Input label={t('password.new')} hint={t('password.rule')} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} dir="ltr" />
          <Input
            label={t('password.confirm')}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            dir="ltr"
            error={mismatch ? t('password.mismatch') : undefined}
          />
          <Button type="submit" loading={mut.isPending} disabled={!current || next.length < 8 || next !== confirm}>
            {t('common.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** شعار المستشفى: يظهر في القائمة الجانبية وصفحة ذوي المريض والطباعة */
function LogoCard({ logoUrl, canEdit }: { logoUrl: string | null; canEdit: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const { refresh } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const done = async () => {
    await qc.invalidateQueries({ queryKey: ['hospital'] });
    await refresh();
    toast.success(t('common.done'));
  };
  const upload = useMutation({ mutationFn: (f: File) => API.uploadHospitalLogo(f), onSuccess: done });
  const remove = useMutation({ mutationFn: () => API.removeHospitalLogo(), onSuccess: done });

  const onPick = (f: File | undefined) => {
    if (inputRef.current) inputRef.current.value = '';
    if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) return toast.error(t('logo.badType'));
    if (f.size > 300 * 1024) return toast.error(t('logo.tooBig'));
    upload.mutate(f);
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-ink/15 p-4 dark:border-white/15">
      <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-ink/10">
        {logoUrl ? <img src={logoUrl} alt={t('logo.title')} className="h-full w-full object-contain" /> : <Hospital className="h-8 w-8 text-ink/25" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">{t('logo.title')}</p>
        <p className="text-xs text-ink/55">{t('logo.hint')}</p>
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
          <Button size="sm" variant="secondary" icon={<ImagePlus className="h-4 w-4" />} loading={upload.isPending} onClick={() => inputRef.current?.click()}>
            {logoUrl ? t('logo.change') : t('logo.upload')}
          </Button>
          {logoUrl && (
            <Button size="sm" variant="ghost" className="text-danger-600" icon={<Trash2 className="h-4 w-4" />} loading={remove.isPending} onClick={() => remove.mutate()}>
              {t('logo.remove')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
