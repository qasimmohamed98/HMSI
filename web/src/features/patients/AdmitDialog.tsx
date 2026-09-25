import { localName } from '@/lib/format';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { Patient } from '@hmsi/shared';
import type { PublicUser } from '@hmsi/shared';
import { Dialog, Select, Button, EmptyState } from '@/components/ui';
import { Textarea } from '@/components/ui/Textarea';
import { API, type AdmitInput } from '@/lib/api';

export function AdmitDialog({
  open,
  onClose,
  patient,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  patient: Patient;
  onSubmit: (input: AdmitInput) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const { data: wards } = useQuery({ queryKey: ['wards'], queryFn: API.wards });
  const { data: doctors } = useQuery({ queryKey: ['doctors'], queryFn: API.listDoctors });

  const departments = useMemo(() => {
    if (!wards) return [];
    const seen = new Map<string, { id: string; nameAr: string; nameEn: string }>();
    for (const w of wards) {
      if (!seen.has(w.department_id)) seen.set(w.department_id, { id: w.department_id, nameAr: w.department_name_ar, nameEn: w.department_name_en });
    }
    return [...seen.values()];
  }, [wards]);

  const [departmentId, setDepartmentId] = useState('');
  const [wardId, setWardId] = useState('');
  const [bedId, setBedId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const selectedWard = wards?.find((w) => w.id === wardId);
  const freeBeds = selectedWard?.beds.filter((b) => b.status === 'free') ?? [];

  const reset = () => {
    setDepartmentId('');
    setWardId('');
    setBedId('');
    setDoctorId('');
    setReason('');
    setError('');
  };

  const chooseDepartment = (id: string) => {
    setDepartmentId(id);
    setWardId('');
    setBedId('');
  };

  const submit = () => {
    if (!bedId) {
      setError(t('admit.required'));
      return;
    }
    onSubmit({ patientId: patient.id, bedId, departmentId, attendingDoctorId: doctorId || null, reason: reason.trim() || undefined });
    reset();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${t('admit.title')} — ${localName(patient, 'full_name')}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={busy} disabled={freeBeds.length === 0}>
            {t('admit.submit')}
          </Button>
        </>
      }
    >
      {!wards ? (
        <div className="py-4">
          <EmptyState title={t('errors.generic')} />
        </div>
      ) : departments.length === 0 ? (
        <div className="py-4">
          <EmptyState title={t('admit.noFreeBeds')} />
        </div>
      ) : (
        <div className="space-y-4">
          {error && <p className="text-sm font-semibold text-danger-600">{error}</p>}
          <Select
            label={t('admit.department')}
            value={departmentId}
            onChange={(e) => chooseDepartment(e.target.value)}
            options={departments.map((d) => ({ value: d.id, label: localName({ name_ar: d.nameAr, name_en: d.nameEn }, 'name') }))}
            placeholder={t('admit.selectDepartment')}
          />
          {departmentId && (
            <Select
              label={t('admit.ward')}
              value={wardId}
              onChange={(e) => {
                setWardId(e.target.value);
                setBedId('');
              }}
              options={(wards ?? []).filter((w) => w.department_id === departmentId).map((w) => ({ value: w.id, label: localName(w, 'name') }))}
              placeholder={t('admit.selectWard')}
            />
          )}
          {wardId && (
            <Select
              label={t('admit.bed')}
              value={bedId}
              onChange={(e) => setBedId(e.target.value)}
              options={freeBeds.map((b) => ({ value: b.id, label: `${b.room} / ${b.bed_no}` }))}
              placeholder={freeBeds.length === 0 ? t('admit.noFreeBeds') : t('admit.selectBed')}
            />
          )}
          <Select
            label={t('admit.attendingDoctor')}
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            options={(doctors ?? []).map((d: PublicUser) => ({ value: d.id, label: localName(d, 'full_name') }))}
            placeholder={t('admit.noDoctor')}
          />
          <Textarea label={t('admit.reason')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </div>
      )}
    </Dialog>
  );
}