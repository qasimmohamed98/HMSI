import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Patient } from '@hmsi/shared';
import { Search, UserPlus, BedDouble, Stethoscope, Pencil, Archive, KeyRound } from 'lucide-react';
import { Card, Button, Badge, Skeleton, EmptyState, Avatar, TableRoot, THead, TBody, Th, Td, TRow, StatusBadge, ConfirmDialog, Dialog } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/Input';
import { API, type PatientUpdateInput } from '@/lib/api';
import { calcAge, fmtDate } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media';
import { NewPatientDialog } from '@/features/patients/NewPatientDialog';
import { EditPatientDialog } from '@/features/patients/EditPatientDialog';
import { AdmitDialog } from '@/features/patients/AdmitDialog';
import { useToast } from '@/components/ui'

export default function PatientsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isTablet = useMediaQuery('(max-width: 1023px)');

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [admittedOnly, setAdmittedOnly] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [admitTarget, setAdmitTarget] = useState<Patient | null>(null);
  // رمز العائلة يُعرض مرة بعد التنويم ليُسلَّم لذوي المريض
  const [admittedPin, setAdmittedPin] = useState<{ name: string; pin: string } | null>(null);
  const [editTarget, setEditTarget] = useState<Patient | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Patient | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(h);
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['patients', debounced, admittedOnly],
    queryFn: () => API.listPatients({ search: debounced, admitted: admittedOnly }),
  });

  const invalidatePatients = () => {
    void qc.invalidateQueries({ queryKey: ['patients', debounced, admittedOnly] });
    void qc.invalidateQueries({ queryKey: ['patients', undefined, false] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
    void qc.invalidateQueries({ queryKey: ['wards'] });
  };

  const createMut = useMutation({
    mutationFn: API.createPatient,
    onSuccess: () => {
      invalidatePatients();
      setShowNew(false);
    },
  });

  const admitMut = useMutation({
    mutationFn: API.admitPatient,
    onSuccess: (res) => {
      invalidatePatients();
      void qc.invalidateQueries({ queryKey: ['wards'] });
      if (admitTarget) setAdmittedPin({ name: admitTarget.full_name_ar, pin: res.family_pin });
      setAdmitTarget(null);
    },
  });

  const updateMut = useMutation({
    mutationFn: (args: { id: string; input: PatientUpdateInput }) => API.updatePatient(args.id, args.input),
    onSuccess: () => {
      invalidatePatients();
      setEditTarget(null);
      toast.success(t('common.done'));
    },
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => API.deletePatient(id),
    onSuccess: () => {
      invalidatePatients();
      setArchiveTarget(null);
      toast.success(t('common.done'));
    },
  });

  return (
    <div>
      <PageHeader
        title={t('patients.title')}
        subtitle={t('patients.subtitle')}
        actions={
          <Button onClick={() => setShowNew(true)} icon={<UserPlus className="h-4 w-4" />}>
            {t('patients.newPatient')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('patients.searchPlaceholder')}
            className="ps-9"
            containerClassName="gap-0"
          />
        </div>
        <button
          type="button"
          onClick={() => setAdmittedOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors sm:self-auto ${
            admittedOnly
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200'
              : 'text-ink/55 hover:bg-surface-muted dark:text-white/60'
          }`}
        >
          <BedDouble className="h-4 w-4" />
          {t('patients.admittedToday')}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error || !data ? (
        <Card>
          <EmptyState title={t('errors.generic')} />
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState title={search ? t('patients.noResults') : t('patients.empty')} />
        </Card>
      ) : isMobile || isTablet ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.map((p) => (
            <PatientMobileCard
              key={p.id}
              patient={p}
              onClick={() => navigate(`/patients/${p.id}`)}
              onAdmit={!p.activeAdmission ? () => setAdmitTarget(p) : undefined}
              onEdit={() => setEditTarget(p)}
              onArchive={() => setArchiveTarget(p)}
            />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <TableRoot>
            <THead>
              <tr>
                <Th>{t('patients.fileNumber')}</Th>
                <Th>{t('patients.name')}</Th>
                <Th>{t('patients.age')}</Th>
                <Th>{t('patients.bloodType')}</Th>
                <Th>{t('patients.department')}</Th>
                <Th>{t('patients.ward')}</Th>
                <Th>{t('patients.bed')}</Th>
                <Th>{t('patients.admittedAt')}</Th>
                <Th>{t('patients.status')}</Th>
                <Th>{t('common.actions')}</Th>
              </tr>
            </THead>
            <TBody>
              {data.map((p) => (
                <TRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/patients/${p.id}`)}>
                  <Td className="tabular font-bold text-brand-700 dark:text-brand-300">{p.file_number}</Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={p.full_name_ar} className="h-9 w-9 text-xs" />
                      <div>
                        <p className="font-bold text-ink">{p.full_name_ar}</p>
                        <p className="text-xs text-ink/45">{p.full_name_en}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="tabular">{calcAge(p.birth_date)}</Td>
                  <Td>
                    <Badge variant="outline">{p.blood_type}</Badge>
                  </Td>
                  <Td>{p.activeAdmission?.department_name_ar ?? '—'}</Td>
                  <Td>{p.activeAdmission?.ward_name_ar ?? '—'}</Td>
                  <Td className="tabular">
                    {p.activeAdmission ? `${p.activeAdmission.room} / ${p.activeAdmission.bed_no}` : '—'}
                  </Td>
                  <Td className="tabular">
                    {p.activeAdmission ? fmtDate(p.activeAdmission.admitted_at, { day: 'numeric', month: 'short' }) : '—'}
                  </Td>
                  <Td>{p.activeAdmission ? <StatusBadge status="active" /> : <StatusBadge status={p.status} />}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <Button size="icon-sm" variant="ghost" aria-label={t('common.edit')} onClick={(e) => { e.stopPropagation(); setEditTarget(p); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t('common.archive')}
                        className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                        onClick={(e) => { e.stopPropagation(); setArchiveTarget(p); }}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                      {!p.activeAdmission && (
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Stethoscope className="h-3.5 w-3.5" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setAdmitTarget(p);
                          }}
                        >
                          {t('admit.action')}
                        </Button>
                      )}
                    </div>
                  </Td>
                </TRow>
              ))}
            </TBody>
          </TableRoot>
        </Card>
      )}

      <NewPatientDialog open={showNew} onClose={() => setShowNew(false)} onSubmit={(input) => createMut.mutate(input)} busy={createMut.isPending} />
      {editTarget && (
        <EditPatientDialog open onClose={() => setEditTarget(null)} patient={editTarget} onSubmit={(input) => updateMut.mutate({ id: editTarget.id, input })} busy={updateMut.isPending} />
      )}
      {archiveTarget && (
        <ConfirmDialog
          open
          onClose={() => setArchiveTarget(null)}
          title={t('patients.archivePatient')}
          message={t('patients.archiveConfirm', { name: archiveTarget.full_name_ar })}
          confirmLabel={t('common.archive')}
          busy={archiveMut.isPending}
          onConfirm={() => archiveMut.mutate(archiveTarget.id)}
        />
      )}
      {admittedPin && (
        <Dialog
          open
          onClose={() => setAdmittedPin(null)}
          title={`${t('familyPin.admittedTitle')} — ${admittedPin.name}`}
          footer={<Button onClick={() => setAdmittedPin(null)}>{t('common.close')}</Button>}
        >
          <div className="space-y-3 text-center">
            <KeyRound className="mx-auto h-8 w-8 text-brand-600" />
            <p className="text-sm font-bold text-ink/60">{t('familyPin.title')}</p>
            <p className="font-mono text-4xl font-extrabold tracking-[0.35em] text-ink" dir="ltr">{admittedPin.pin}</p>
            <p className="text-sm leading-relaxed text-ink/60">{t('familyPin.admittedHint')}</p>
          </div>
        </Dialog>
      )}
      {admitTarget && (
        <AdmitDialog open onClose={() => setAdmitTarget(null)} patient={admitTarget} onSubmit={(input) => admitMut.mutate(input)} busy={admitMut.isPending} />
      )}
    </div>
  );
}

function PatientMobileCard({ patient: p, onClick, onAdmit, onEdit, onArchive }: { patient: Patient; onClick: () => void; onAdmit?: () => void; onEdit?: () => void; onArchive?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ink/8 bg-surface-raised p-4 shadow-card transition-all hover:border-brand-300 hover:shadow-float dark:border-white/10 dark:hover:border-brand-700">
      <button type="button" onClick={onClick} className="flex w-full items-start gap-3 text-start">
        <Avatar name={p.full_name_ar} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold text-ink">{p.full_name_ar}</p>
            {p.activeAdmission ? <StatusBadge status="active" /> : <StatusBadge status={p.status} />}
          </div>
          <p className="text-xs text-ink/45">
            {p.file_number} · {t('gender.' + p.gender)} · {calcAge(p.birth_date)} سنة
          </p>
          {p.activeAdmission ? (
            <p className="mt-1.5 text-xs font-semibold text-ink/65">
              {p.activeAdmission.department_name_ar} · {p.activeAdmission.ward_name_ar} · {p.activeAdmission.room}/{p.activeAdmission.bed_no}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-ink/40">{t('status.discharged')}</p>
          )}
        </div>
      </button>
      <div className="flex items-center gap-1.5">
        {onAdmit && (
          <Button size="sm" variant="outline" icon={<Stethoscope className="h-3.5 w-3.5" />} onClick={onAdmit}>
            {t('admit.action')}
          </Button>
        )}
        {onEdit && (
          <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit}>
            {t('common.edit')}
          </Button>
        )}
        {onArchive && (
          <Button size="sm" variant="ghost" className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30" icon={<Archive className="h-3.5 w-3.5" />} onClick={onArchive}>
            {t('common.archive')}
          </Button>
        )}
      </div>
    </div>
  );
}