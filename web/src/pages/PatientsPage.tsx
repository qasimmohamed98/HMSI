import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Patient } from '@hmsi/shared';
import { Search, UserPlus, BedDouble, Stethoscope } from 'lucide-react';
import { Card, Button, Badge, Skeleton, EmptyState, Avatar, TableRoot, THead, TBody, Th, Td, TRow, StatusBadge } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/Input';
import { API } from '@/lib/api';
import { calcAge, fmtDate } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media';
import { NewPatientDialog } from '@/features/patients/NewPatientDialog';
import { AdmitDialog } from '@/features/patients/AdmitDialog';

export default function PatientsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isTablet = useMediaQuery('(max-width: 1023px)');

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [admittedOnly, setAdmittedOnly] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [admitTarget, setAdmitTarget] = useState<Patient | null>(null);

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
    onSuccess: () => {
      invalidatePatients();
      setAdmitTarget(null);
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
            <PatientMobileCard key={p.id} patient={p} onClick={() => navigate(`/patients/${p.id}`)} onAdmit={!p.activeAdmission ? () => setAdmitTarget(p) : undefined} />
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
                <Th>{t('admit.action')}</Th>
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
                  </Td>
                </TRow>
              ))}
            </TBody>
          </TableRoot>
        </Card>
      )}

      <NewPatientDialog open={showNew} onClose={() => setShowNew(false)} onSubmit={(input) => createMut.mutate(input)} busy={createMut.isPending} />
      {admitTarget && (
        <AdmitDialog open onClose={() => setAdmitTarget(null)} patient={admitTarget} onSubmit={(input) => admitMut.mutate(input)} busy={admitMut.isPending} />
      )}
    </div>
  );
}

function PatientMobileCard({ patient: p, onClick, onAdmit }: { patient: Patient; onClick: () => void; onAdmit?: () => void }) {
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
      {onAdmit && (
        <Button size="sm" variant="outline" icon={<Stethoscope className="h-3.5 w-3.5" />} onClick={onAdmit}>
          {t('admit.action')}
        </Button>
      )}
    </div>
  );
}