import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HandHelping, Stethoscope, UserPlus, UserRound, X } from 'lucide-react';
import { hasPermission } from '@hmsi/shared';
import { Alert, Badge, Button, Card, CardContent, Dialog, Input, Select, useConfirm, useToast } from '@/components/ui';
import { API, type CareMember, type ChartData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { localName } from '@/lib/format';

/** فريق الرعاية للتنويم: الأطباء (مع التخصص والرئيسي) والممرض المعيَّن */
export function CareTeamCard({ chart }: { chart: ChartData }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const admissionId = chart.admissionId!;
  const active = chart.patient.admission?.status === 'active';
  const [dialog, setDialog] = useState<'doctor' | 'nurse' | null>(null);

  const q = useQuery({ queryKey: ['careTeam', admissionId], queryFn: () => API.careTeam(admissionId) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['careTeam', admissionId] });
    void qc.invalidateQueries({ queryKey: ['chart', chart.patient.id] });
    void qc.invalidateQueries({ queryKey: ['rounds'] });
  };
  const add = useMutation({
    mutationFn: (v: { userId: string; role: 'doctor' | 'nurse'; specialty?: string; primary?: boolean }) => API.addCareMember(admissionId, v),
    onSuccess: () => {
      refresh();
      setDialog(null);
      toast.success(t('common.done'));
    },
  });
  const end = useMutation({ mutationFn: (m: CareMember) => API.endCareMember(admissionId, m.id), onSuccess: refresh });

  const isAdmin = hasPermission(user?.role, 'users.manage');
  const canAddDoctor = active && (isAdmin || hasPermission(user?.role, 'admissions.manage'));
  const members = q.data?.members ?? [];
  const doctors = members.filter((m) => m.role === 'doctor');
  const nurse = members.find((m) => m.role === 'nurse');
  const pending = q.data?.pending_handover;
  const canAssignNurse = active && !nurse && (isAdmin || user?.role === 'nurse');

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold text-ink">{t('careTeam.title')}</p>
          <div className="flex flex-wrap gap-2">
            {canAddDoctor && (
              <Button size="sm" variant="outline" icon={<UserPlus className="h-4 w-4" />} onClick={() => setDialog('doctor')}>
                {t('careTeam.addDoctor')}
              </Button>
            )}
            {canAssignNurse && user?.role === 'nurse' && (
              <Button size="sm" icon={<HandHelping className="h-4 w-4" />} loading={add.isPending} onClick={() => add.mutate({ userId: user.id, role: 'nurse' })}>
                {t('careTeam.takePatient')}
              </Button>
            )}
            {canAssignNurse && (
              <Button size="sm" variant="outline" icon={<UserRound className="h-4 w-4" />} onClick={() => setDialog('nurse')}>
                {t('careTeam.assignNurse')}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div>
            <p className="mb-1.5 text-xs font-bold text-ink/50">{t('careTeam.doctors')}</p>
            {doctors.length === 0 ? (
              <p className="text-sm text-warning-700">{t('careTeam.noDoctor')}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {doctors.map((d) => (
                  <li key={d.id} className="inline-flex items-center gap-1.5 rounded-lg border border-ink/10 px-2.5 py-1.5 text-sm dark:border-white/10">
                    <Stethoscope className="h-3.5 w-3.5 text-brand-600" />
                    <span className="font-semibold text-ink">{localName(d, 'full_name')}</span>
                    {d.specialty && <span className="text-xs text-ink/55">· {d.specialty}</span>}
                    {d.is_primary && <Badge variant="brand">{t('careTeam.primary')}</Badge>}
                    {canAddDoctor && doctors.length > 1 && (
                      <button
                        type="button"
                        aria-label={t('careTeam.remove')}
                        className="rounded p-0.5 text-ink/40 hover:bg-danger-50 hover:text-danger-600"
                        onClick={async () => {
                          if (await confirm(t('careTeam.removeConfirm', { name: localName(d, 'full_name') }))) end.mutate(d);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-ink/50">{t('careTeam.nurse')}</p>
            {nurse ? (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-ink/10 px-2.5 py-1.5 text-sm dark:border-white/10">
                <UserRound className="h-3.5 w-3.5 text-brand-600" />
                <span className="font-semibold text-ink">{localName(nurse, 'full_name')}</span>
                {isAdmin && active && (
                  <button
                    type="button"
                    aria-label={t('careTeam.remove')}
                    className="rounded p-0.5 text-ink/40 hover:bg-danger-50 hover:text-danger-600"
                    onClick={async () => {
                      if (await confirm(t('careTeam.removeConfirm', { name: localName(nurse, 'full_name') }))) end.mutate(nurse);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-warning-700">{active ? t('careTeam.noNurse') : '—'}</p>
            )}
            {pending && <p className="mt-1 text-xs font-semibold text-info-700">{t('careTeam.pendingTo', { name: localName({ name_ar: pending.to_name_ar, name_en: pending.to_name_en }, 'name') })}</p>}
          </div>
        </div>
        {add.error && !dialog && <Alert variant="danger">{(add.error as Error).message}</Alert>}
      </CardContent>

      {dialog && (
        <AddMemberDialog
          role={dialog}
          exclude={members.map((m) => m.user_id)}
          busy={add.isPending}
          error={add.error as Error | null}
          onClose={() => {
            setDialog(null);
            add.reset();
          }}
          onSubmit={(v) => add.mutate({ ...v, role: dialog })}
        />
      )}
    </Card>
  );
}

function AddMemberDialog({
  role,
  exclude,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  role: 'doctor' | 'nurse';
  exclude: string[];
  busy: boolean;
  error: Error | null;
  onClose: () => void;
  onSubmit: (v: { userId: string; specialty?: string; primary?: boolean }) => void;
}) {
  const { t } = useTranslation();
  const staff = useQuery({ queryKey: ['careStaff', role], queryFn: () => API.careStaff(role) });
  const [userId, setUserId] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [primary, setPrimary] = useState(false);
  const options = (staff.data ?? []).filter((s) => !exclude.includes(s.id));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t(role === 'doctor' ? 'careTeam.addDoctor' : 'careTeam.assignNurse')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={busy} disabled={!userId} onClick={() => onSubmit({ userId, specialty: specialty.trim() || undefined, primary })}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select
          label={t(role === 'doctor' ? 'careTeam.doctor' : 'careTeam.nurse')}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          options={[
            { value: '', label: t('careTeam.choose') },
            ...options.map((s) => ({ value: s.id, label: `${localName(s, 'full_name')} — ${t('careTeam.load', { count: s.patients })}` })),
          ]}
        />
        {role === 'doctor' && (
          <>
            <Input label={t('careTeam.specialty')} value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder={t('careTeam.specialtyHint')} />
            <label className="flex items-center gap-2 text-sm text-ink/75">
              <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              {t('careTeam.makePrimary')}
            </label>
          </>
        )}
        {error && <Alert variant="danger">{error.message}</Alert>}
      </div>
    </Dialog>
  );
}
